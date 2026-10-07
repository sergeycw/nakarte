import {trackKey} from './key';

const MAX_TRACK_BYTES = 10 * 1024 * 1024;
const KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
const ALLOWED_METHODS = 'GET, POST, OPTIONS';

function allowedOrigins(env) {
    return (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
    };
}

function respond(origin, status, body = null, headers = {}) {
    return new Response(body, {status, headers: {...corsHeaders(origin), ...headers}});
}

function preflight(request, origin) {
    const headers = {'Access-Control-Allow-Methods': ALLOWED_METHODS};
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    if (requestedHeaders) {
        headers['Access-Control-Allow-Headers'] = requestedHeaders;
    }
    return respond(origin, 204, null, headers);
}

async function readLimited(request, limit) {
    const declaredLength = Number(request.headers.get('Content-Length'));
    if (declaredLength > limit) {
        return null;
    }
    if (!request.body) {
        return new Uint8Array();
    }
    const chunks = [];
    let total = 0;
    for await (const chunk of request.body) {
        total += chunk.byteLength;
        if (total > limit) {
            return null;
        }
        chunks.push(chunk);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

async function saveTrack(request, env, origin, key) {
    const bytes = await readLimited(request, MAX_TRACK_BYTES);
    if (!bytes) {
        return respond(origin, 413, 'Track is too big');
    }
    if (trackKey(new TextDecoder().decode(bytes)) !== key) {
        return respond(origin, 400, 'Key does not match track');
    }
    const objectKey = `tracks/${key}`;
    if (!(await env.TRACKS.head(objectKey))) {
        await env.TRACKS.put(objectKey, bytes);
    }
    return respond(origin, 200);
}

async function loadTrack(env, origin, key) {
    const object = await env.TRACKS.get(`tracks/${key}`);
    if (!object) {
        return respond(origin, 404, 'Track not found');
    }
    return respond(origin, 200, object.body, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=31536000, immutable',
    });
}

const worker = {
    async fetch(request, env) {
        const origin = request.headers.get('Origin');
        if (!origin || !allowedOrigins(env).includes(origin)) {
            return new Response('Origin not allowed', {status: 403});
        }
        if (request.method === 'OPTIONS') {
            return preflight(request, origin);
        }
        const match = new URL(request.url).pathname.match(/^\/track\/([^/]+)$/u);
        if (!match) {
            return respond(origin, 404, 'Not found');
        }
        const key = match[1];
        if (!KEY_PATTERN.test(key)) {
            return respond(origin, 400, 'Malformed key');
        }
        if (request.method === 'POST') {
            return saveTrack(request, env, origin, key);
        }
        if (request.method === 'GET') {
            return loadTrack(env, origin, key);
        }
        return respond(origin, 405, 'Method not allowed', {Allow: ALLOWED_METHODS});
    },
};

export default worker;
