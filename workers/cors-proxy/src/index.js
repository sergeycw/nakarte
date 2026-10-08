const PATH_ALIASES = [['/wikimapia/', 'http://wikimapia.org/']];
// user-agent нужен Wikimapia: её nginx отвечает 403 на запрос без User-Agent, а fetch из Worker'а
// своего не ставит.
const FORWARDED_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'range', 'user-agent'];
// Тайлы Strava Global Heatmap (слои Sa/Sr/Sb/Sw) CloudFront отдаёт только с подписанными куками
// CloudFront-Key-Pair-Id, CloudFront-Policy, CloudFront-Signature от вошедшего аккаунта Strava; без них
// 403 `MissingKey`. Авторский proxy.nakarte.me подставляет такие куки сам, у нас они — секрет
// STRAVA_COOKIES (заводит владелец, срок жизни ограничен). Куки уходят только на эти тайлы.
const STRAVA_HEATMAP = {host: /^content-[a-z]\.strava\.com$/u, path: /^\/identified\/globalheat\//u};
const DROPPED_RESPONSE_HEADERS = ['set-cookie'];
const EXPOSED_HEADERS = 'Content-Disposition';
const ALLOWED_METHODS = 'POST, GET, HEAD, OPTIONS';
// Длина окна `[[ratelimits]]` в wrangler.toml.
const RETRY_AFTER_SECONDS = '60';

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

// Без CF-Connecting-IP (локальный wrangler dev, тесты) частоту не ограничиваем.
async function overLimit(request, env) {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) {
        return false;
    }
    const {success} = await env.RATE_LIMITER.limit({key: ip});
    return !success;
}

function tooManyRequests(origin) {
    return new Response('Too many requests\n', {
        status: 429,
        headers: {...corsHeaders(origin), 'Retry-After': RETRY_AFTER_SECONDS},
    });
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

function isStravaHeatmap(target) {
    const url = new URL(target);
    return STRAVA_HEATMAP.host.test(url.hostname) && STRAVA_HEATMAP.path.test(url.pathname);
}

async function proxy(request, env, origin, target, proxyOrigin) {
    const upstreamHeaders = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) {
            upstreamHeaders.set(name, value);
        }
    }
    if (env.STRAVA_COOKIES && isStravaHeatmap(target)) {
        upstreamHeaders.set('cookie', env.STRAVA_COOKIES);
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
        if (await overLimit(request, env)) {
            return tooManyRequests(origin);
        }
        if (request.method === 'OPTIONS') {
            return preflight(request, origin);
        }
        const target = targetUrl(url);
        if (!target) {
            return new Response('Not found', {status: 404, headers: corsHeaders(origin)});
        }
        return proxy(request, env, origin, target, url.origin);
    },
};

export default worker;
