// Прокси в workerd: CORS по списку origin, протокол адресов авторского прокси, переписывание
// редиректов. Апстрим — заглушка `outboundService` из vitest.config.js, сеть не нужна.
import {exports as workerExports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';

const CLONE_ORIGIN = 'https://nakarte-routing.pages.dev';
const PROXY = 'https://proxy.test';

function request(path, {method = 'GET', origin = CLONE_ORIGIN, headers = {}} = {}) {
    const allHeaders = {...headers};
    if (origin) {
        allHeaders.Origin = origin;
    }
    return workerExports.default.fetch(`${PROXY}${path}`, {method, headers: allHeaders, redirect: 'manual'});
}

describe('origin check', () => {
    it('answers 403 to a foreign Origin and without Origin or Referer', async () => {
        expect((await request('/https/example.com/', {origin: 'https://example.com'})).status).toBe(403);
        expect((await request('/https/example.com/', {origin: null})).status).toBe(403);
    });

    it('accepts an allowed Referer when Origin is absent', async () => {
        const response = await request('/https/example.com/', {
            origin: null,
            headers: {Referer: `${CLONE_ORIGIN}/#m=5/42/44`},
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
    });

    // test_track_load.js апстрима ходит в живые сервисы через этот прокси со страницы karma
    it('accepts the karma origin', async () => {
        const response = await request('/https/example.com/', {origin: 'http://localhost:9876'});
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:9876');
    });

    it('answers preflight with 204, methods and requested headers', async () => {
        const response = await request('/https/example.com/', {
            method: 'OPTIONS',
            headers: {'Access-Control-Request-Headers': 'content-type'},
        });
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, GET, HEAD, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type');
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
});

describe('proxying', () => {
    it('fetches /<scheme>/<host>/<path>?<query> and returns the body with CORS', async () => {
        const response = await request('/https/www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4', {
            headers: {'Accept': 'text/xml', 'Cookie': 'secret=1', 'X-Custom': 'drop'},
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Content-Disposition');
        expect(response.headers.get('X-Upstream')).toBe('yes');
        expect(response.headers.get('Set-Cookie')).toBeNull();
        const echo = await response.json();
        expect(echo.url).toBe('https://www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4');
        expect(echo.headers.accept).toBe('text/xml');
        expect(echo.headers.cookie).toBeUndefined();
        expect(echo.headers['x-custom']).toBeUndefined();
    });

    it('maps /wikimapia/ to http://wikimapia.org/', async () => {
        const echo = await (await request('/wikimapia/z1/itiles/0/1/2.xy?123')).json();
        expect(echo.url).toBe('http://wikimapia.org/z1/itiles/0/1/2.xy?123');
    });

    it('forwards User-Agent', async () => {
        const echo = await (
            await request('/wikimapia/z1/itiles/0/1/2.xy', {headers: {'User-Agent': 'Browser/1.0'}})
        ).json();
        expect(echo.headers['user-agent']).toBe('Browser/1.0');
    });

    // STRAVA_COOKIES задан в vitest.config.js
    it('adds Strava cookies only to heatmap tiles', async () => {
        const heatmap = '/https/content-a.strava.com/identified/globalheat/all/hot/12/2557/1514.png?px=256';
        const echo = await (await request(heatmap, {headers: {Cookie: 'client=1'}})).json();
        expect(echo.headers.cookie).toBe('CloudFront-Key-Pair-Id=k; CloudFront-Policy=p; CloudFront-Signature=s');

        for (const path of [
            '/https/www.strava.com/activities/1/streams',
            '/https/example.com/identified/globalheat/x',
        ]) {
            expect((await (await request(path)).json()).headers.cookie).toBeUndefined();
        }
    });

    it('rewrites Location of a redirect back through the proxy', async () => {
        const response = await request('/https/example.com/redirect');
        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe(`${PROXY}/https/example.com/moved?page=2`);
    });

    it('answers 404 with CORS to an unknown path', async () => {
        const response = await request('/ftp/example.com/file');
        expect(response.status).toBe(404);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
    });
});

describe('rate limit', () => {
    // в vitest.config.js лимит понижен до 3 запросов за 60 с
    function fromIp(ip, options = {}) {
        return request('/https/example.com/', {...options, headers: {'CF-Connecting-IP': ip, ...options.headers}});
    }

    it('answers 429 with Retry-After and CORS after the limit, per IP', async () => {
        for (let i = 0; i < 3; i++) {
            expect((await fromIp('192.0.2.1')).status).toBe(200);
        }
        const limited = await fromIp('192.0.2.1');
        expect(limited.status).toBe(429);
        expect(limited.headers.get('Retry-After')).toBe('60');
        expect(limited.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(await limited.text()).toBe('Too many requests\n');
        expect((await fromIp('192.0.2.2')).status).toBe(200);
    });

    it('answers 403 to a foreign Origin without spending the limit', async () => {
        for (let i = 0; i < 5; i++) {
            expect((await fromIp('192.0.2.3', {origin: 'https://example.com'})).status).toBe(403);
        }
        expect((await fromIp('192.0.2.3')).status).toBe(200);
    });

    it('does not limit requests without CF-Connecting-IP', async () => {
        for (let i = 0; i < 5; i++) {
            expect((await request('/https/example.com/')).status).toBe(200);
        }
    });
});
