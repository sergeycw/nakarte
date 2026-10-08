// Частота запросов с одного IP в собранном wasm-Worker: привязки `[[ratelimits]]`, свои счётчики
// у тайлов и API, бюджет чтений R2 у API, `429` с CORS. В vitest.config.js лимиты понижены: тайлы — 3,
// API — 2 вызова и 5 единиц бюджета (по 64 чтения) за 60 с.
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

// Точки в `count` разных градусах: на каждый — заголовок и кусок, то есть 2 × count чтений.
function scattered(count) {
    return Array.from({length: count}, (_, i) => `${(i % 100) - 49.5} ${Math.floor(i / 100) * 10 + 0.5}`).join('\n');
}

describe('reads budget', () => {
    it('answers 413 to points that touch more than 512 reads, before the budget', async () => {
        const response = await fromIp('192.0.2.10', '/', {method: 'POST', origin: CLONE_ORIGIN, body: scattered(300)});
        expect(response.status).toBe(413);
        expect(await response.text()).toBe('Request too big\n');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
    });

    it('answers 429 when the reads budget of the IP is spent', async () => {
        // 100 градусов — 200 чтений, 4 единицы из 5
        const first = await fromIp('192.0.2.11', '/', {method: 'POST', origin: CLONE_ORIGIN, body: scattered(100)});
        expect(first.status).toBe(200);
        const second = await fromIp('192.0.2.11', '/', {method: 'POST', origin: CLONE_ORIGIN, body: scattered(100)});
        expect(second.status).toBe(429);
        expect(second.headers.get('Retry-After')).toBe('60');
        expect(second.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(second.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('does not spend the reads budget without CF-Connecting-IP', async () => {
        for (let i = 0; i < 3; i++) {
            const response = await workerExports.default.fetch('https://elevation.test/', {
                method: 'POST',
                headers: {Origin: CLONE_ORIGIN},
                body: scattered(100),
            });
            expect(response.status).toBe(200);
        }
    });
});
