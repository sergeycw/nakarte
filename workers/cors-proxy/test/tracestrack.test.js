// Ключ Tracestrack (спека cors-proxy, «Ключ Tracestrack»): прокси подставляет секрет TRACESTRACK_KEY только в растровые
// тайлы topo__ и не отдаёт его клиенту. Tracestrack — заглушка из vitest.config.js, отвечает эхом запроса.
import {exports as workerExports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';

import worker from '../src/index.js';

const ORIGIN = 'https://nakarte-routing.pages.dev';
// то же значение — привязка TRACESTRACK_KEY в vitest.config.js
const KEY = 'test-tracestrack-key';
const TILE = '/https/tile.tracestrack.com/topo__/10/618/377.webp';

function request(path, headers = {}) {
    return workerExports.default.fetch(`https://proxy.test${path}`, {
        headers: {Origin: ORIGIN, ...headers},
        redirect: 'manual',
    });
}

async function upstreamUrl(response) {
    expect(response.status).toBe(200);
    return new URL((await response.json()).url);
}

async function tracestrackCalls() {
    return (await (await fetch('https://stub.test/calls')).json()).tracestrack;
}

describe('Tracestrack key', () => {
    it('adds the key from the secret to a topo tile', async () => {
        const response = await request(TILE);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        expect((await upstreamUrl(response)).href).toBe(
            `https://tile.tracestrack.com/topo__/10/618/377.webp?key=${KEY}`
        );
    });

    it('adds the key to a @2x tile', async () => {
        const url = await upstreamUrl(await request('/https/tile.tracestrack.com/topo__/10/618/377@2x.webp'));
        expect(url.searchParams.get('key')).toBe(KEY);
    });

    it('drops the client query, including a foreign key', async () => {
        const url = await upstreamUrl(await request(`${TILE}?key=other&x=1`));
        expect([...url.searchParams]).toEqual([['key', KEY]]);
    });

    it.each([
        '/https/tile.tracestrack.com/topo_ru/10/618/377.png',
        '/https/tile.tracestrack.com/topo__/10/618/377.png',
        '/https/tile.tracestrack.com/v/10/618/377.pbf',
    ])('sends other Tracestrack paths without the key: %s', async (path) => {
        const url = await upstreamUrl(await request(path));
        expect(url.searchParams.has('key')).toBe(false);
    });

    it('answers 503 with CORS and does not call Tracestrack without the secret', async () => {
        const before = await tracestrackCalls();
        const response = await worker.fetch(
            new Request(`https://proxy.test${TILE}`, {headers: {Origin: ORIGIN}}),
            {ALLOWED_ORIGINS: ORIGIN},
            null
        );
        expect(response.status).toBe(503);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        expect(await response.text()).toBe('Tracestrack key is not set\n');
        expect(await tracestrackCalls()).toBe(before);
    });

    it('rewrites a redirect without the key', async () => {
        const response = await request('/https/tile.tracestrack.com/topo__/3/999/2.webp');
        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe('https://proxy.test/https/tile.tracestrack.com/topo__/3/1/2.webp');
    });

    it('sets a day of Cache-Control when Tracestrack sends none', async () => {
        const response = await request(TILE);
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
    });

    it('keeps the Cache-Control of Tracestrack', async () => {
        const response = await request('/https/tile.tracestrack.com/topo__/10/618/7.webp');
        expect(response.headers.get('Cache-Control')).toBe('max-age=60');
    });

    it('leaves Cache-Control of other hosts alone', async () => {
        const response = await request('/https/example.com/track.gpx');
        expect(response.headers.has('Cache-Control')).toBe(false);
    });

    it('counts Tracestrack tiles as layer tiles', async () => {
        // лимиты в vitest.config.js: хосты слоёв — 3, остальные — 2 запроса за 60 с
        const fromIp = {'CF-Connecting-IP': '192.0.2.10'};
        for (let i = 0; i < 3; i++) {
            expect((await request(TILE, fromIp)).status).toBe(200);
        }
        expect((await request(TILE, fromIp)).status).toBe(429);
    });
});
