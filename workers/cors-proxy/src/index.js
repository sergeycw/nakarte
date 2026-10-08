import {anonymousTileUrl, heatmapCookie, isStravaHeatmap} from './strava';

const PATH_ALIASES = [['/wikimapia/', 'http://wikimapia.org/']];
// user-agent нужен Wikimapia: её nginx отвечает 403 на запрос без User-Agent, а fetch из Worker'а
// своего не ставит.
const FORWARDED_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'range', 'user-agent'];
const DROPPED_RESPONSE_HEADERS = ['set-cookie'];
const EXPOSED_HEADERS = 'Content-Disposition';
const ALLOWED_METHODS = 'POST, GET, HEAD, OPTIONS';
// На эти ответы CloudFront на тайл с куками прокси пробует анонимный тайл: куки протухли или не приняты.
const STRAVA_REJECTED = [401, 403];
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

async function proxy(request, env, ctx, origin, target, proxyOrigin) {
    const upstreamHeaders = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) {
            upstreamHeaders.set(name, value);
        }
    }
    // куки Strava уходят только на тайлы heatmap, cookie клиента не пересылается никогда (src/strava.js)
    const strava = isStravaHeatmap(target) ? await heatmapCookie(env, ctx) : null;
    if (strava?.cookie) {
        upstreamHeaders.set('cookie', strava.cookie);
    }
    // HEAD уходит к сервису как GET, как у авторского прокси на nginx (proxy_cache_convert_head):
    // короткие ссылки mapy.com на HEAD отвечают 404, а на GET — редиректом, который и нужен клиенту.
    const isHead = request.method === 'HEAD';
    const isRead = ['GET', 'HEAD'].includes(request.method);
    function send(url) {
        return fetch(url, {
            method: isHead ? 'GET' : request.method,
            headers: upstreamHeaders,
            body: isRead ? null : request.body,
            redirect: 'manual',
        });
    }
    // без кук или с отвергнутыми куками тайл z≤12 берётся с анонимного адреса Strava, без кук
    const anonymous = strava && isRead ? anonymousTileUrl(target) : null;
    let stravaSource = strava?.source;
    let upstream = null;
    if (anonymous && stravaSource === 'none') {
        upstream = await send(anonymous);
        stravaSource = 'anonymous';
    } else {
        upstream = await send(target);
    }
    if (anonymous && stravaSource !== 'anonymous' && STRAVA_REJECTED.includes(upstream.status)) {
        await upstream.body?.cancel();
        upstreamHeaders.delete('cookie');
        upstream = await send(anonymous);
        stravaSource = 'anonymous';
    }
    if (isHead) {
        await upstream.body?.cancel();
    }

    const headers = new Headers(upstream.headers);
    for (const name of DROPPED_RESPONSE_HEADERS) {
        headers.delete(name);
    }
    for (const [name, value] of Object.entries(corsHeaders(origin))) {
        headers.set(name, value);
    }
    // откуда куки тайла (session, fallback, anonymous, none) — для проверки STRAVA_SESSION
    if (strava) {
        headers.set('X-Strava-Cookies', stravaSource);
    }
    const location = upstream.headers.get('Location');
    if (location) {
        headers.set('Location', proxiedUrl(proxyOrigin, new URL(location, target).href));
    }
    return new Response(isHead ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
    });
}

const worker = {
    async fetch(request, env, ctx) {
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
        return proxy(request, env, ctx, origin, target, url.origin);
    },
};

export default worker;
