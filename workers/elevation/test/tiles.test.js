// Тайлы высот в собранном wasm-Worker: маршрут `/tiles/`, gzip без повторного сжатия рантаймом
// (`encodeBody: "manual"`), CORS `*` без `Origin`, архив z0–9 в R2 и тайлы z10–11 на лету.
// Значения подробно сверяют cargo-тесты; здесь — что адаптер их не портит. Тело ответа с
// `Content-Encoding: gzip` workerd при чтении из JS распаковывает сам, поэтому тест сравнивает уже
// сырые 131 072 байта: при двойном сжатии после одной распаковки остался бы gzip.
import {env} from 'cloudflare:test';
import {exports as workerExports} from 'cloudflare:workers';
import {beforeAll, describe, expect, it} from 'vitest';

const ARCHIVE_KEY = 'tiles/elevation-z0-9';

function fromBase64(base64) {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function get(path, headers = {}) {
    return workerExports.default.fetch(`https://elevation.test${path}`, {headers});
}

async function gunzip(bytes) {
    const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Архив формата `core/src/archive.rs` с максимальным зумом 1: заголовок `NKT1`, индекс из пяти
// записей (`u64` смещение, `u32` длина, LE), тела; в нём только тайл 0/0/0.
function buildArchive(body) {
    const entries = 5;
    const headerLength = 8 + entries * 12;
    const archive = new Uint8Array(headerLength + body.length);
    archive.set([0x4e, 0x4b, 0x54, 0x31, 1, 0, 0, 0]);
    const view = new DataView(archive.buffer);
    view.setBigUint64(8, BigInt(headerLength), true);
    view.setUint32(16, body.length, true);
    archive.set(body, headerLength);
    return archive;
}

beforeAll(async () => {
    for (const [key, base64] of Object.entries(env.FIXTURE_OBJECTS)) {
        await env.DEM.put(key, fromBase64(base64));
    }
    await env.DEM.put(ARCHIVE_KEY, buildArchive(fromBase64(env.FIXTURE_TILES['0-0-0'])));
});

describe('GET /tiles/{z}/{x}/{y}', () => {
    it('renders z11 like the author tile, without Origin', async () => {
        const response = await get('/tiles/11/1277/754');
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Encoding')).toBe('gzip');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Cache-Control')).toBe('max-age=86400');
        const raw = new Uint8Array(await response.arrayBuffer());
        expect(raw.length).toBe(131072);
        expect(raw).toEqual(await gunzip(fromBase64(env.FIXTURE_TILES['11-1277-754'])));
    });

    it('renders z10 on the fly with a foreign Origin', async () => {
        const response = await get('/tiles/10/638/377', {Origin: 'https://example.com'});
        expect(response.status).toBe(200);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        const raw = new Uint8Array(await response.arrayBuffer());
        expect(raw).toEqual(await gunzip(fromBase64(env.FIXTURE_TILES['10-638-377'])));
    });

    it('serves archived tiles as stored', async () => {
        const response = await get('/tiles/0/0/0');
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Encoding')).toBe('gzip');
        const raw = new Uint8Array(await response.arrayBuffer());
        expect(raw.length).toBe(131072);
        expect(raw).toEqual(await gunzip(fromBase64(env.FIXTURE_TILES['0-0-0'])));
    });

    it('answers 404 with CORS for ocean, gaps, zooms above 11 and bad paths', async () => {
        for (const path of [
            '/tiles/11/796/844',
            '/tiles/1/1/1',
            '/tiles/5/0/0',
            '/tiles/12/2554/1508',
            '/tiles/x/y/z',
        ]) {
            const response = await get(path);
            expect(response.status, path).toBe(404);
            expect(response.headers.get('Access-Control-Allow-Origin'), path).toBe('*');
        }
    });
});
