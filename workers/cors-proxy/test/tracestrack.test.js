// Ключ Tracestrack (спека cors-proxy, «Ключ Tracestrack»): прокси подставляет секрет TRACESTRACK_KEY только в растровые
// тайлы topo__ и не отдаёт его клиенту. Tracestrack — заглушка из vitest.config.js, отвечает эхом запроса. Названия
// тестов — сценарии спеки.
import {exports as workerExports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';

import worker from '../src/index.js';

const ORIGIN = 'https://nakarte-routing.pages.dev';
// то же значение — привязка TRACESTRACK_KEY в vitest.config.js
const KEY = 'test-tracestrack-key';
const TILE = '/https/tile.tracestrack.com/topo__/10/618/377.webp';

function request(path, {method = 'GET', headers = {}} = {}) {
    return workerExports.default.fetch(`https://proxy.test${path}`, {
        method,
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

function headersText(response) {
    return JSON.stringify([...response.headers]);
}

describe('Ключ Tracestrack', () => {
    it('Тайл Tracestrack', async () => {
        const response = await request(TILE);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        expect((await upstreamUrl(response)).href).toBe(
            `https://tile.tracestrack.com/topo__/10/618/377.webp?key=${KEY}`
        );
    });

    it('тайл @2x тоже с ключом', async () => {
        const url = await upstreamUrl(await request('/https/tile.tracestrack.com/topo__/10/618/377@2x.webp'));
        expect(url.searchParams.get('key')).toBe(KEY);
    });

    it('Ключ клиента не проходит', async () => {
        const url = await upstreamUrl(await request(`${TILE}?key=other&x=1`));
        expect([...url.searchParams]).toEqual([['key', KEY]]);
    });

    it.each([
        '/https/tile.tracestrack.com/topo_ru/10/618/377.png',
        '/https/tile.tracestrack.com/topo__/10/618/377.png',
        '/https/tile.tracestrack.com/v/10/618/377.pbf',
        '/https/api.tracestrack.com/v1/elevation',
        // ключ уходит только по https на стандартный порт
        '/http/tile.tracestrack.com/topo__/10/618/377.webp',
        '/https/tile.tracestrack.com:8443/topo__/10/618/377.webp',
    ])('Другой адрес Tracestrack: %s', async (path) => {
        const response = await request(path);
        expect(response.status).toBe(200);
        expect(JSON.stringify(await response.json())).not.toContain(KEY);
    });

    it('Ключ не задан', async () => {
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

    it('Редирект Tracestrack', async () => {
        const response = await request('/https/tile.tracestrack.com/topo__/3/999/2.webp');
        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe('https://proxy.test/https/tile.tracestrack.com/topo__/3/1/2.webp');
    });

    it('Отказ Tracestrack', async () => {
        const response = await request('/https/tile.tracestrack.com/topo__/3/403/2.webp');
        expect(response.status).toBe(403);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        expect(await response.text()).toBe('Tracestrack error 403\n');
        expect(headersText(response)).not.toContain(KEY);
    });

    it('заголовки тайла — по белому списку, без ключа', async () => {
        const response = await request(TILE);
        expect(response.headers.has('X-Debug-Key')).toBe(false);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(headersText(response)).not.toContain(KEY);
    });

    it('HEAD тайла — без тела и без ключа в заголовках', async () => {
        const response = await request(TILE, {method: 'HEAD'});
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('');
        expect(headersText(response)).not.toContain(KEY);
    });

    it('Кеш тайла', async () => {
        const response = await request(TILE);
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
    });

    it('свой Cache-Control Tracestrack не трогается', async () => {
        const response = await request('/https/tile.tracestrack.com/topo__/10/618/7.webp');
        expect(response.headers.get('Cache-Control')).toBe('max-age=60');
    });

    it('Cache-Control других хостов не трогается', async () => {
        const response = await request('/https/example.com/track.gpx');
        expect(response.headers.has('Cache-Control')).toBe(false);
    });
});

describe('Частота запросов к Worker\'ам с одного IP', () => {
    it('Тайлы Tracestrack — тайлы слоя', async () => {
        // лимиты в vitest.config.js: хосты слоёв — 3, остальные — 2 запроса за 60 с
        const fromIp = {headers: {'CF-Connecting-IP': '192.0.2.10'}};
        for (let i = 0; i < 3; i++) {
            expect((await request(TILE, fromIp)).status).toBe(200);
        }
        expect((await request(TILE, fromIp)).status).toBe(429);
    });
});
