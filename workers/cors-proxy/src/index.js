const PATH_ALIASES = [['/wikimapia/', 'http://wikimapia.org/']];
const FORWARDED_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'range'];
const DROPPED_RESPONSE_HEADERS = ['set-cookie'];
const EXPOSED_HEADERS = 'Content-Disposition';
const ALLOWED_METHODS = 'POST, GET, HEAD, OPTIONS';

function allowedOrigins(env) {
    return (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function callerOrigin(request, allowed) {
    const origin = request.headers.get('Origin');
    if (origin) {
        return allowed.includes(origin) ? origin : null;
    }
    const referer = request.headers.get('Referer');
    if (!referer) {
        return null;
    }
    try {
        const refererOrigin = new URL(referer).origin;
        return allowed.includes(refererOrigin) ? refererOrigin : null;
    } catch {
        return null;
    }
}

function targetUrl(url) {
    for (const [prefix, base] of PATH_ALIASES) {
        if (url.pathname.startsWith(prefix)) {
            return base + url.pathname.slice(prefix.length) + url.search;
        }
    }
    const match = url.pathname.match(/^\/(https?)\/(.+)$/u);
    if (!match) {
        return null;
    }
    return `${match[1]}://${match[2]}${url.search}`;
}

function proxiedUrl(proxyOrigin, absoluteUrl) {
    const url = new URL(absoluteUrl);
    return `${proxyOrigin}/${url.protocol.slice(0, -1)}/${url.host}${url.pathname}${url.search}`;
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': EXPOSED_HEADERS,
        'Vary': 'Origin',
    };
}

function preflight(request, origin) {
    const headers = new Headers(corsHeaders(origin));
    headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    if (requestedHeaders) {
        headers.set('Access-Control-Allow-Headers', requestedHeaders);
    }
    return new Response(null, {status: 204, headers});
}

async function proxy(request, origin, target, proxyOrigin) {
    const upstreamHeaders = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) {
            upstreamHeaders.set(name, value);
        }
    }
    const upstream = await fetch(target, {
        method: request.method,
        headers: upstreamHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        redirect: 'manual',
    });

    const headers = new Headers(upstream.headers);
    for (const name of DROPPED_RESPONSE_HEADERS) {
        headers.delete(name);
    }
    for (const [name, value] of Object.entries(corsHeaders(origin))) {
        headers.set(name, value);
    }
    const location = upstream.headers.get('Location');
    if (location) {
        headers.set('Location', proxiedUrl(proxyOrigin, new URL(location, target).href));
    }
    return new Response(upstream.body, {status: upstream.status, statusText: upstream.statusText, headers});
}

const worker = {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = callerOrigin(request, allowedOrigins(env));
        if (!origin) {
            return new Response('Forbidden', {status: 403});
        }
        if (request.method === 'OPTIONS') {
            return preflight(request, origin);
        }
        const target = targetUrl(url);
        if (!target) {
            return new Response('Not found', {status: 404, headers: corsHeaders(origin)});
        }
        return proxy(request, origin, target, url.origin);
    },
};

export default worker;
