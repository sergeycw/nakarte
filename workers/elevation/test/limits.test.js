// Частота запросов с одного IP в собранном wasm-Worker: привязки `[[ratelimits]]`, свои счётчики
// у тайлов и API, `429` с CORS. В vitest.config.js лимиты понижены: тайлы — 3, API — 2 за 60 с.
import {exports as workerExports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';

const CLONE_ORIGIN = 'https://nakarte-routing.pages.dev';

function fromIp(ip, path, {method = 'GET', origin, body} = {}) {
    const headers = {'CF-Connecting-IP': ip};
    if (origin) {
        headers.Origin = origin;
    }
    return workerExports.default.fetch(`https://elevation.test${path}`, {method, headers, body});
}

function tile(ip) {
    return fromIp(ip, '/tiles/11/796/844');
}

function api(ip, origin = CLONE_ORIGIN) {
    return fromIp(ip, '/', {method: 'POST', origin, body: ''});
}

describe('rate limit', () => {
    it('answers 429 to tiles after the limit, with CORS * and Retry-After', async () => {
        for (let i = 0; i < 3; i++) {
            expect((await tile('192.0.2.1')).status).toBe(404);
        }
        const limited = await tile('192.0.2.1');
        expect(limited.status).toBe(429);
        expect(limited.headers.get('Retry-After')).toBe('60');
        expect(limited.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(await limited.text()).toBe('Too many requests\n');
    });

    it('keeps the API counter separate from tiles', async () => {
        for (let i = 0; i < 4; i++) {
            await tile('192.0.2.2');
        }
        expect((await api('192.0.2.2')).status).toBe(200);
    });

    it('answers 429 to the API with the reflected Origin, 403 does not spend it', async () => {
        for (let i = 0; i < 3; i++) {
            expect((await api('192.0.2.3', 'https://example.com')).status).toBe(403);
        }
        for (let i = 0; i < 2; i++) {
            expect((await api('192.0.2.3')).status).toBe(200);
        }
        const limited = await api('192.0.2.3');
        expect(limited.status).toBe(429);
        expect(limited.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(limited.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('does not limit requests without CF-Connecting-IP', async () => {
        for (let i = 0; i < 5; i++) {
            const response = await workerExports.default.fetch('https://elevation.test/tiles/11/796/844');
            expect(response.status).toBe(404);
        }
    });
});
