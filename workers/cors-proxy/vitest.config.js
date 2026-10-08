/* eslint camelcase: ["error", {"allow": ["namespace_id"]}] */
import {cloudflareTest} from '@cloudflare/vitest-pool-workers';
import {defineConfig} from 'vitest/config';

// Срок политики CloudFront в заглушке Strava, секунды (2033 год); то же число — в test/strava.test.js.
const STRAVA_POLICY_EPOCH = 2_000_000_000;

// CloudFront-Policy — base64 JSON политики с заменами CloudFront: + → -, = → _, / → ~.
function cloudFrontPolicy(epoch) {
    const json = JSON.stringify({
        Statement: [
            {
                Resource: 'https://content-*.strava.com/identified/globalheat/*',
                Condition: {DateLessThan: {'AWS:EpochTime': epoch}},
            },
        ],
    });
    return btoa(json).replace(/\+/gu, '-').replace(/[=]/gu, '_').replace(/\//gu, '~');
}

// Сколько раз заглушка Strava видела каждую сессию; тест читает это через https://stub.test/calls.
const stravaCalls = new Map();
const offsiteCalls = [];

// Страница www.strava.com/maps/global-heatmap. Поведение задаёт значение `_strava4_session`
// до первого `-`: ok, redirect, login, offsite, anon, partial, noexpiry, error; хвост делает сессию уникальной,
// чтобы тесты не делили кеш изолята.
function stravaPage(request) {
    const url = new URL(request.url);
    const session = /_strava4_session=([^;]+)/u.exec(request.headers.get('cookie') ?? '')?.[1] ?? '';
    stravaCalls.set(session, (stravaCalls.get(session) ?? 0) + 1);
    const mode = session.split('-')[0];
    const headers = new Headers({'Content-Type': 'text/html'});
    function cookie(name, value) {
        headers.append('Set-Cookie', `${name}=${value}; Domain=.strava.com; Path=/; Secure; HttpOnly`);
    }
    if (mode === 'login') {
        return new Response(null, {status: 302, headers: {Location: 'https://www.strava.com/login'}});
    }
    if (mode === 'offsite') {
        return new Response(null, {status: 302, headers: {Location: 'https://evil.test/collect'}});
    }
    if (mode === 'anon') {
        return new Response('<html></html>', {headers});
    }
    if (mode === 'error') {
        return new Response('oops', {status: 503});
    }
    if (mode === 'redirect' && !url.searchParams.has('moved')) {
        return new Response(null, {status: 302, headers: {Location: '/maps/global-heatmap?moved=1'}});
    }
    // ротацию сессии прокси обязан игнорировать
    cookie('_strava4_session', 'rotated; Expires=Fri, 08 Oct 2027 00:00:00 GMT');
    cookie('_strava_CloudFront-Expires', String(STRAVA_POLICY_EPOCH * 1000));
    cookie('CloudFront-Policy', mode === 'noexpiry' ? 'not-a-policy' : cloudFrontPolicy(STRAVA_POLICY_EPOCH));
    cookie('CloudFront-Signature', `sig-${session}`);
    if (mode !== 'partial') {
        cookie('CloudFront-Key-Pair-Id', 'kp');
        cookie('_strava_idcf', `jwt-${session}`);
    }
    return new Response('<html></html>', {headers});
}

// Апстрим прокси подменяет `outboundService`: тест не ходит в сеть. Заглушка отвечает эхом
// запроса (адрес, метод, заголовки) и отдаёт заголовки, которые прокси обязан вырезать или переписать.
function upstream(request) {
    const url = new URL(request.url);
    if (url.host === 'stub.test' && url.pathname === '/calls') {
        const session = url.searchParams.get('session');
        return Response.json({strava: stravaCalls.get(session) ?? 0, offsite: offsiteCalls.length});
    }
    if (url.host === 'www.strava.com' && url.pathname === '/maps/global-heatmap') {
        return stravaPage(request);
    }
    // CloudFront Strava: без кук и с «мёртвыми» куками (STRAVA_COOKIES из теста) — 403 MissingKey
    if (/^content-[a-z]\.strava\.com$/u.test(url.host)) {
        const cookie = request.headers.get('cookie') ?? '';
        if (!cookie || cookie.includes('CloudFront-Signature=dead')) {
            return new Response('MissingKey', {status: 403, headers: {'Content-Type': 'text/plain'}});
        }
    }
    // анонимная heatmap: эхо запроса тайла, как у остальных адресов, но с типом картинки
    if (/^heatmap-external-[abc]\.strava\.com$/u.test(url.host)) {
        return Response.json(
            {url: request.url, method: request.method, headers: Object.fromEntries(request.headers)},
            {headers: {'X-Anonymous-Tile': 'yes'}}
        );
    }
    if (url.host === 'evil.test') {
        offsiteCalls.push(request.url);
    }
    if (url.pathname === '/redirect') {
        return new Response(null, {status: 302, headers: {Location: '/moved?page=2'}});
    }
    return Response.json(
        {url: request.url, method: request.method, headers: Object.fromEntries(request.headers)},
        {headers: {'Set-Cookie': 'session=1', 'X-Upstream': 'yes', 'X-Upstream-Method': request.method}}
    );
}

const STRAVA_COOKIES = 'CloudFront-Key-Pair-Id=k; CloudFront-Policy=p; CloudFront-Signature=s; _strava_idcf=j';

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: {configPath: './wrangler.toml'},
            // лимиты частоты понижены (слои — 3, остальные хосты — 2), чтобы `429` проверялся несколькими запросами;
            // `namespace_id` — имя поля miniflare, camelCase тут не выбрать
            miniflare: {
                outboundService: upstream,
                // секреты wrangler secret put STRAVA_SESSION / STRAVA_COOKIES; тут — заглушки
                bindings: {STRAVA_SESSION: '_strava4_session=ok-worker', STRAVA_COOKIES},
                ratelimits: {
                    RATE_LIMITER: {namespace_id: '1004', simple: {limit: 3, period: 60}},
                    OTHER_RATE_LIMITER: {namespace_id: '1007', simple: {limit: 2, period: 60}},
                },
            },
        }),
    ],
});
