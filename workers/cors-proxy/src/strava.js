// Куки для тайлов Strava Global Heatmap (слои Sa/Sr/Sb/Sw). CloudFront отдаёт тайлы
// content-*.strava.com/identified/globalheat/ только с подписанными куками CloudFront-Key-Pair-Id,
// CloudFront-Policy, CloudFront-Signature (без них 403 `MissingKey`) и JWT-кукой _strava_idcf (без неё
// функция CloudFront отвечает 401). Живут они около суток.
//
// Их ставит сам ответ HTML-страницы www.strava.com/maps/global-heatmap вошедшему пользователю
// (найдено 2026-10-08 в браузере владельца: запросы getKey и notifications их не ставят). Поэтому
// прокси держит секрет STRAVA_SESSION — куки сессии Strava в форме заголовка Cookie — и сам
// запрашивает эту страницу, когда куки кончаются. Запасной путь — статический секрет STRAVA_COOKIES
// (scripts/strava-heatmap-secret.mjs). Решения — openspec/changes/*-add-strava-heatmap-refresh/design.md.
//
// Ни сессия, ни куки, ни строки Set-Cookie не попадают в журнал: только имена и статусы.
// fetchHeatmapCookies не зависит от env Worker'а: её импортирует scripts/strava-session-secret.mjs под Node.

const HEATMAP_COOKIES = ['CloudFront-Key-Pair-Id', 'CloudFront-Policy', 'CloudFront-Signature', '_strava_idcf'];
const HEATMAP_TILE = {host: /^content-[a-z]\.strava\.com$/u, path: /^\/identified\/globalheat\//u};
const HEATMAP_PAGE = 'https://www.strava.com/maps/global-heatmap';
// сессия уходит только сюда: редирект на другой origin — неудача без перехода
const STRAVA_ORIGIN = 'https://www.strava.com';
// так Strava отвечает на отклонённую сессию
const LOGIN_PATH = /^\/(login|session)\b/u;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
// Strava отдаёт страницу браузеру; пустой User-Agent fetch'а Worker'а рискует получить отказ, как у Wikimapia
const USER_AGENT = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
].join(' ');

// Куки обновляются за 30 минут до срока политики: разница часов и тайлы, начатые перед сроком.
const EXPIRY_MARGIN_MS = 30 * 60 * 1000;
// Политика не разобралась — лишнее обновление через час лучше кук неизвестной свежести.
const UNKNOWN_EXPIRY_TTL_MS = 60 * 60 * 1000;
// После неудачи (сессия отклонена, Strava ответила не так) не дёргать страницу на каждый тайл.
const RETRY_PAUSE_MS = 10 * 60 * 1000;

// Анонимная heatmap: без входа Strava отдаёт те же тайлы с heatmap-external-{a,b,c}.strava.com/tiles/
// до z12 при px=256 и до z11 при px=512, выше — 403 (замер 2026-10-08; так же делает canicule). Прокси
// берёт их, когда кук нет или CloudFront их не принял: слои не пустеют на обзорных зумах без сессии.
const ANONYMOUS_MAX_ZOOM = {256: 12, 512: 11};
const ANONYMOUS_HOSTS = ['a', 'b', 'c'];
const HEATMAP_TILE_PATH = /^\/identified\/globalheat\/(\w+)\/(\w+)\/(\d+)\/(\d+)\/(\d+)\.png$/u;

// Адрес того же тайла без входа или null, если зум выше порога. Без px Strava отдаёт 256.
function anonymousTileUrl(target) {
    const url = new URL(target);
    const match = HEATMAP_TILE_PATH.exec(url.pathname);
    if (!match) {
        return null;
    }
    const [, activity, color, z, x, y] = match;
    const px = url.searchParams.get('px') ?? '256';
    const maxZoom = ANONYMOUS_MAX_ZOOM[px];
    if (maxZoom === undefined || Number(z) > maxZoom) {
        return null;
    }
    // поддомен по тайлу, как subdomains у Leaflet: один тайл — всегда один хост
    const host = ANONYMOUS_HOSTS[(Number(x) + Number(y)) % ANONYMOUS_HOSTS.length];
    return `https://heatmap-external-${host}.strava.com/tiles/${activity}/${color}/${z}/${x}/${y}.png?px=${px}`;
}

function isStravaHeatmap(target) {
    const url = new URL(target);
    return HEATMAP_TILE.host.test(url.hostname) && HEATMAP_TILE.path.test(url.pathname);
}

// CloudFront-Policy — JSON политики в base64 с заменами CloudFront: + → -, = → _, / → ~.
// Срок — Condition.DateLessThan['AWS:EpochTime'] первого Statement, в секундах. Возвращает миллисекунды.
function policyExpiry(policy) {
    try {
        const json = atob(policy.replace(/-/gu, '+').replace(/_/gu, '=').replace(/~/gu, '/'));
        const epoch = JSON.parse(json).Statement[0].Condition.DateLessThan['AWS:EpochTime'];
        return Number.isFinite(epoch) ? epoch * 1000 : null;
    } catch {
        return null;
    }
}

// Имя куки и её срок из атрибутов Expires/Max-Age, без значения: по этому журналу видно, продлевает ли
// Strava сессию (_strava4_session в ответе) и насколько.
function describeSetCookie(line) {
    const [pair, ...attributes] = line.split(';');
    const name = pair.slice(0, pair.indexOf('=')).trim();
    const lifetime = attributes
        .map((attribute) => attribute.trim())
        .filter((attribute) => /^(expires|max-age)=/iu.test(attribute));
    return lifetime.length ? `${name} (${lifetime.join(', ')})` : name;
}

function collectHeatmapCookies(response, found, seen) {
    for (const line of response.headers.getSetCookie()) {
        seen.push(describeSetCookie(line));
        const pair = line.split(';', 1)[0];
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq).trim();
        if (eq > 0 && HEATMAP_COOKIES.includes(name)) {
            found.set(name, pair.slice(eq + 1).trim());
        }
    }
}

// Ошибка с описанием всех Set-Cookie цепочки (имена и сроки), чтобы журнал показал их и при неудаче.
function refreshError(message, seen) {
    return Object.assign(new Error(message), {setCookies: seen});
}

// Ошибки несут только статус, путь и имена кук: их текст идёт в журнал и в вывод скрипта.
// setCookies — имена и сроки всех кук из ответов, без значений.
async function fetchHeatmapCookies(session, fetchImpl = fetch) {
    const found = new Map();
    const seen = [];
    let url = HEATMAP_PAGE;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetchImpl(url, {
            headers: {'cookie': session, 'accept': 'text/html', 'user-agent': USER_AGENT},
            redirect: 'manual',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        // нужны только заголовки: HTML не читаем, CPU на него не тратим
        await response.body?.cancel();
        collectHeatmapCookies(response, found, seen);
        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400 && location) {
            const next = new URL(location, url);
            if (next.origin !== STRAVA_ORIGIN) {
                throw refreshError(
                    `strava page redirects off ${STRAVA_ORIGIN}: ${response.status} to ${next.host}`,
                    seen
                );
            }
            if (LOGIN_PATH.test(next.pathname)) {
                throw refreshError(`strava session rejected: ${response.status} to ${next.pathname}`, seen);
            }
            url = next.href;
            continue;
        }
        if (!response.ok) {
            throw refreshError(`strava page answered ${response.status}`, seen);
        }
        // так Strava ответила 2026-10-08 на подставную сессию: 200 без кук, а не редирект на /login
        if (!found.size) {
            throw refreshError(`strava page set no heatmap cookies: ${response.status}, session not logged in`, seen);
        }
        const missing = HEATMAP_COOKIES.filter((name) => !found.has(name));
        if (missing.length) {
            throw refreshError(`strava page set no ${missing.join(', ')}`, seen);
        }
        return {
            cookie: HEATMAP_COOKIES.map((name) => `${name}=${found.get(name)}`).join('; '),
            expiresAt: policyExpiry(found.get('CloudFront-Policy')),
            setCookies: seen,
        };
    }
    throw refreshError(`strava page redirects more than ${MAX_REDIRECTS} times`, seen);
}

// Состояние изолята. Промис обновления разрешается строкой, а не Response, поэтому его можно ждать
// из параллельных запросов (I/O-объекты между запросами делить нельзя). Смена STRAVA_SESSION
// сбрасывает всё.
const state = {session: null, cookie: null, freshUntil: 0, expiresAt: 0, failedAt: -Infinity, refreshing: null};

function resetState(session) {
    Object.assign(state, {session, cookie: null, freshUntil: 0, expiresAt: 0, failedAt: -Infinity, refreshing: null});
}

// Лучшее из имеющегося, пока свежих кук нет: старые, если CloudFront их ещё примет, иначе запасной секрет.
function bestKnown(now, fallback) {
    return state.cookie && now < state.expiresAt ? {cookie: state.cookie, source: 'session'} : fallback;
}

async function refresh(session, now) {
    try {
        const {cookie, expiresAt, setCookies} = await fetchHeatmapCookies(session);
        console.log(`strava page set-cookie: ${setCookies.join('; ')}`);
        if (state.session !== session) {
            return null;
        }
        if (expiresAt === null) {
            Object.assign(state, {
                cookie,
                expiresAt: now + UNKNOWN_EXPIRY_TTL_MS,
                freshUntil: now + UNKNOWN_EXPIRY_TTL_MS,
            });
            return cookie;
        }
        // политика короче запаса — всё равно не чаще раза в паузу
        Object.assign(state, {
            cookie,
            expiresAt,
            freshUntil: Math.max(expiresAt - EXPIRY_MARGIN_MS, now + RETRY_PAUSE_MS),
        });
        return cookie;
    } catch (error) {
        console.error(`strava heatmap cookies not refreshed: ${error.message}`);
        if (error.setCookies?.length) {
            console.error(`strava page set-cookie: ${error.setCookies.join('; ')}`);
        }
        if (state.session === session) {
            state.failedAt = now;
        }
        return null;
    } finally {
        if (state.session === session) {
            state.refreshing = null;
        }
    }
}

// Куки для тайла heatmap: {cookie, source}, source — session, fallback или none (без кук).
// `ctx` — контекст запроса Worker'а: обновление регистрируется в waitUntil, чтобы обрыв клиента
// не отменил fetch, которого ждут параллельные запросы.
async function heatmapCookie(env, ctx, now = Date.now()) {
    const fallback = env.STRAVA_COOKIES
        ? {cookie: env.STRAVA_COOKIES, source: 'fallback'}
        : {cookie: null, source: 'none'};
    const session = env.STRAVA_SESSION;
    if (!session) {
        return fallback;
    }
    if (state.session !== session) {
        resetState(session);
    }
    if (state.cookie && now < state.freshUntil) {
        return {cookie: state.cookie, source: 'session'};
    }
    if (now - state.failedAt < RETRY_PAUSE_MS) {
        return bestKnown(now, fallback);
    }
    if (!state.refreshing) {
        state.refreshing = refresh(session, now);
        ctx?.waitUntil(state.refreshing);
    }
    const cookie = await state.refreshing;
    return cookie ? {cookie, source: 'session'} : bestKnown(now, fallback);
}

export {
    HEATMAP_COOKIES,
    RETRY_PAUSE_MS,
    anonymousTileUrl,
    fetchHeatmapCookies,
    heatmapCookie,
    isStravaHeatmap,
    policyExpiry,
};
