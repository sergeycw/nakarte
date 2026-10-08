const PATH_PREFIX = '/tiles/';
const EMPTY_FILES = ['storageconfig.txt'];
const CACHE_CONTROL = 'public, max-age=86400';

function objectHeaders(object) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', CACHE_CONTROL);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/octet-stream');
    }
    return headers;
}

function resolvedRange(object) {
    const {range, size} = object;
    if ('suffix' in range) {
        return {offset: size - range.suffix, length: range.suffix};
    }
    const offset = range.offset ?? 0;
    return {offset, length: range.length ?? size - offset};
}

function startsPastEnd(rangeHeader, size) {
    const match = /^bytes=(\d+)-/u.exec(rangeHeader ?? '');
    return Boolean(match) && Number(match[1]) >= size;
}

async function head(env, key) {
    const object = await env.TILES.head(key);
    if (!object) {
        return new Response(null, {status: 404});
    }
    const headers = objectHeaders(object);
    headers.set('Content-Length', String(object.size));
    return new Response(null, {headers});
}

async function get(request, env, key) {
    const hasRange = request.headers.has('Range');
    let object;
    try {
        object = await env.TILES.get(key, {range: request.headers});
    } catch {
        return new Response(null, {status: 416});
    }
    if (!object) {
        return new Response('Not found', {status: 404});
    }
    // R2 в Cloudflare на диапазон за концом объекта бросает исключение (выше → 416), а локальный R2
    // miniflare отдаёт объект; проверяем сами, чтобы wrangler dev и тесты вели себя как прод.
    if (hasRange && startsPastEnd(request.headers.get('Range'), object.size)) {
        await object.body.cancel();
        return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${object.size}`}});
    }
    const headers = objectHeaders(object);
    if (!hasRange || !object.range) {
        headers.set('Content-Length', String(object.size));
        return new Response(object.body, {headers});
    }
    const {offset, length} = resolvedRange(object);
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, {status: 206, headers});
}

const worker = {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (!url.pathname.startsWith(PATH_PREFIX)) {
            return new Response('Not found', {status: 404});
        }
        if (!['GET', 'HEAD'].includes(request.method)) {
            return new Response('Method not allowed', {status: 405});
        }
        const key = decodeURIComponent(url.pathname.slice(PATH_PREFIX.length));
        if (EMPTY_FILES.includes(key)) {
            return new Response('', {headers: {'Content-Length': '0'}});
        }
        if (request.method === 'HEAD') {
            return head(env, key);
        }
        return get(request, env, key);
    },
};

export default worker;
