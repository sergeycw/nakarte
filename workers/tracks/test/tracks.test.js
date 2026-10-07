import md5 from 'blueimp-md5';
import {env} from 'cloudflare:test';
import {exports as workerExports} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';

import fixture from './fixtures/client-track.json';

const CLONE_ORIGIN = 'https://nakarte-routing.pages.dev';

function clientKey(serialized) {
    const hashDigest = md5(serialized, null, true);
    return btoa(hashDigest).replace(/\//gu, '_').replace(/\+/gu, '-').replace(/=/gu, '');
}

function request(path, {method = 'GET', body, origin = CLONE_ORIGIN, headers = {}} = {}) {
    const allHeaders = {...headers};
    if (origin) {
        allHeaders.Origin = origin;
    }
    return workerExports.default.fetch(`https://tracks.test${path}`, {method, body, headers: allHeaders});
}

function postTrack(key, body, options = {}) {
    return request(`/track/${key}`, {method: 'POST', body, ...options});
}

describe('POST /track/{key}', () => {
    it('stores a new track', async () => {
        const body = 'new track';
        const key = clientKey(body);
        const response = await postTrack(key, body);
        expect(response.status).toBe(200);
        const stored = await env.TRACKS.get(`tracks/${key}`);
        expect(await stored.text()).toBe(body);
    });

    it('answers 200 on repeated write and keeps the stored object', async () => {
        const body = 'repeated track';
        const key = clientKey(body);
        await postTrack(key, body);
        const {uploaded} = await env.TRACKS.head(`tracks/${key}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        const response = await postTrack(key, body);
        expect(response.status).toBe(200);
        expect((await env.TRACKS.head(`tracks/${key}`)).uploaded).toEqual(uploaded);
    });

    it('rejects a key of another body with 400 and stores nothing', async () => {
        const keyOfB = clientKey('track B');
        const response = await postTrack(keyOfB, 'track A');
        expect(response.status).toBe(400);
        expect(await env.TRACKS.head(`tracks/${keyOfB}`)).toBeNull();
    });

    it('keeps the original body when a forged write targets its key', async () => {
        const keyOfB = clientKey('track B');
        await postTrack(keyOfB, 'track B');
        const response = await postTrack(keyOfB, 'track A');
        expect(response.status).toBe(400);
        expect(await (await env.TRACKS.get(`tracks/${keyOfB}`)).text()).toBe('track B');
    });

    for (const key of ['short', 'a'.repeat(23), 'aaaaaaaaaaaaaaaaaaaa%3D', 'aaaaaaaaaaaaaaaaaaaaa=']) {
        it(`rejects malformed key ${key} with 400`, async () => {
            const response = await postTrack(key, 'track');
            expect(response.status).toBe(400);
        });
    }

    it('rejects a body over 10 MiB with 413 and stores nothing', async () => {
        const body = 'x'.repeat(10 * 1024 * 1024 + 1);
        const key = clientKey(body);
        const response = await postTrack(key, body);
        expect(response.status).toBe(413);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(await env.TRACKS.head(`tracks/${key}`)).toBeNull();
    });

    it('rejects a streamed body over 10 MiB without Content-Length', async () => {
        const chunk = new Uint8Array(1024 * 1024).fill(120);
        let sent = 0;
        const body = new ReadableStream({
            pull(controller) {
                if (sent > 10) {
                    controller.close();
                    return;
                }
                sent += 1;
                controller.enqueue(chunk);
            },
        });
        const response = await workerExports.default.fetch('https://tracks.test/track/aaaaaaaaaaaaaaaaaaaaaa', {
            method: 'POST',
            body,
            duplex: 'half',
            headers: {Origin: CLONE_ORIGIN},
        });
        expect(response.status).toBe(413);
    });

    it('accepts a body of exactly 10 MiB', async () => {
        const body = 'y'.repeat(10 * 1024 * 1024);
        const response = await postTrack(clientKey(body), body);
        expect(response.status).toBe(200);
    });
});

describe('GET /track/{key}', () => {
    it('returns the stored body as text/plain', async () => {
        const body = 'stored track';
        const key = clientKey(body);
        await postTrack(key, body);
        const response = await request(`/track/${key}`);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('text/plain');
        expect(await response.text()).toBe(body);
    });

    it('answers 404 on an unknown key', async () => {
        const response = await request(`/track/${clientKey('never stored')}`);
        expect(response.status).toBe(404);
    });
});

describe('CORS', () => {
    it('reflects an allowed Origin with credentials', async () => {
        const body = 'cors track';
        const response = await postTrack(clientKey(body), body);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('answers OPTIONS with 204 and allowed methods', async () => {
        const response = await request(`/track/${clientKey('x')}`, {
            method: 'OPTIONS',
            headers: {'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'},
        });
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type');
    });

    it('answers 403 to a foreign Origin and stores nothing', async () => {
        const body = 'foreign track';
        const key = clientKey(body);
        const response = await postTrack(key, body, {origin: 'https://example.com'});
        expect(response.status).toBe(403);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(await env.TRACKS.head(`tracks/${key}`)).toBeNull();
    });

    it('answers 403 without Origin', async () => {
        const response = await request(`/track/${clientKey('x')}`, {origin: null});
        expect(response.status).toBe(403);
    });
});

describe('client compatibility', () => {
    it('computes the same key as the client did', () => {
        expect(clientKey(fixture.serialized)).toBe(fixture.key);
    });

    it('accepts the key made by the client and returns the track back', async () => {
        const saved = await postTrack(fixture.key, fixture.serialized);
        expect(saved.status).toBe(200);
        const loaded = await request(`/track/${fixture.key}`);
        expect(await loaded.text()).toBe(fixture.serialized);
    });
});

describe('rate limit', () => {
    // в vitest.config.js лимит понижен до 3 запросов за 60 с
    const KEY = 'AAAAAAAAAAAAAAAAAAAAAA';
    function fromIp(ip, options = {}) {
        return request(`/track/${KEY}`, {...options, headers: {'CF-Connecting-IP': ip, ...options.headers}});
    }

    it('answers 429 with Retry-After and CORS after the limit, per IP', async () => {
        for (let i = 0; i < 3; i++) {
            expect((await fromIp('192.0.2.1')).status).toBe(404);
        }
        const limited = await fromIp('192.0.2.1');
        expect(limited.status).toBe(429);
        expect(limited.headers.get('Retry-After')).toBe('60');
        expect(limited.headers.get('Access-Control-Allow-Origin')).toBe(CLONE_ORIGIN);
        expect(limited.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(await limited.text()).toBe('Too many requests\n');
        expect((await fromIp('192.0.2.2')).status).toBe(404);
    });

    it('answers 403 to a foreign Origin without spending the limit', async () => {
        for (let i = 0; i < 5; i++) {
            expect((await fromIp('192.0.2.3', {origin: 'https://example.com'})).status).toBe(403);
        }
        expect((await fromIp('192.0.2.3')).status).toBe(404);
    });
});
