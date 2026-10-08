# CORS-прокси и Strava heatmap

Worker `nakarte-cors-proxy` ([workers/cors-proxy](../../workers/cors-proxy/)) повторяет протокол авторского `proxy.nakarte.me`: клиент приписывает к адресу прокси исходный URL (`urlViaCorsProxy` в [CORSProxy](../../src/lib/CORSProxy/index.js)), прокси забирает ответ и отдаёт его с CORS-заголовками. Через него идут импорт треков по ссылкам, поиск mapy.cz и раскрытие коротких ссылок, слои Wikimapia, Tsvetkov, Strava heatmap и растеризация слоёв с `noCors` для печати.

Поведение — спека [cors-proxy](../../openspec/specs/cors-proxy/spec.md); лимиты — [protection.md](protection.md).

## Обработка запроса

```mermaid
flowchart TD
    req["Запрос /{https|http}/{host}/{path}<br/>или /wikimapia/…"]
    origin{"Origin или Referer<br/>в ALLOWED_ORIGINS?"}
    rate{"RATE_LIMITER<br/>по CF-Connecting-IP"}
    options{"OPTIONS?"}
    target{"targetUrl разобрался?"}
    strava{"тайл heatmap<br/>content-*.strava.com/identified/globalheat/?"}
    cookies["heatmapCookie: куки и их источник"]
    send["fetch(target), redirect manual<br/>заголовки: accept, accept-language,<br/>content-type, range, user-agent (+ cookie)<br/>HEAD уходит как GET"]
    resp["Ответ клиенту: без set-cookie,<br/>с CORS, Location переписан на прокси,<br/>X-Strava-Cookies для тайлов heatmap"]
    r403["403 Forbidden"]
    r429["429, Retry-After: 60"]
    r204["204 preflight"]
    r404["404"]

    req --> origin
    origin -->|"нет"| r403
    origin -->|"да"| rate
    rate -->|"превышен"| r429
    rate -->|"ок"| options
    options -->|"да"| r204
    options -->|"нет"| target
    target -->|"нет"| r404
    target -->|"да"| strava
    strava -->|"да"| cookies --> send
    strava -->|"нет"| send
    send --> resp
```

Код — `fetch` и `proxy` в [index.js](../../workers/cors-proxy/src/index.js). Почему `HEAD` уходит как `GET`, зачем пересылается `User-Agent` и откуда origin karma `localhost:9876` — архив [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md).

## Куки Strava heatmap

Тайлы `content-*.strava.com/identified/globalheat/` CloudFront отдаёт только с подписанными куками вошедшего аккаунта. Прокси держит их сам, клиент про них не знает. Источник кук для тайла уходит в заголовок `X-Strava-Cookies` ([strava.js](../../workers/cors-proxy/src/strava.js), `heatmapCookie`).

```mermaid
flowchart TD
    start["Тайл heatmap"]
    hasSession{"секрет STRAVA_SESSION задан?"}
    fresh{"куки из сессии свежие<br/>(до срока политики − 30 мин)?"}
    paused{"неудача меньше 10 мин назад?"}
    refresh["Обновление, одно на изолят:<br/>GET www.strava.com/maps/global-heatmap<br/>с сессией, редиректы только внутри www.strava.com"]
    ok{"пришли все 4 куки?"}
    best{"старые куки ещё до срока?"}
    fallback{"секрет STRAVA_COOKIES задан?"}
    session(["session"])
    fb(["fallback"])
    none(["none"])

    start --> hasSession
    hasSession -->|"нет"| fallback
    hasSession -->|"да"| fresh
    fresh -->|"да"| session
    fresh -->|"нет"| paused
    paused -->|"да"| best
    paused -->|"нет"| refresh --> ok
    ok -->|"да"| session
    ok -->|"нет, пауза 10 мин"| best
    best -->|"да"| session
    best -->|"нет"| fallback
    fallback -->|"да"| fb
    fallback -->|"нет"| none
```

Что прокси делает с источником:

```mermaid
flowchart LR
    src{"источник кук"}
    anon["GET heatmap-external-{a,b,c}.strava.com/tiles/…<br/>без кук: z ≤ 12 при px=256, z ≤ 11 при px=512"]
    cf["GET content-*.strava.com/identified/globalheat/…<br/>с куками, если они есть"]
    rej{"ответ 401 или 403?"}
    out(["тайл клиенту,<br/>X-Strava-Cookies = источник"])

    src -->|"none, зум до порога"| anon
    src -->|"session, fallback;<br/>none выше порога"| cf
    cf --> rej
    rej -->|"нет, или зум выше порога"| out
    rej -->|"да, зум до порога"| anon
    anon -->|"X-Strava-Cookies: anonymous"| out
```

- Секреты Worker'а `STRAVA_SESSION` и `STRAVA_COOKIES` заводит владелец скриптами [strava-session-secret.mjs](../../scripts/strava-session-secret.mjs) и [strava-heatmap-secret.mjs](../../scripts/strava-heatmap-secret.mjs); сессия и куки не попадают в журнал и не уходят никуда, кроме `www.strava.com` и тайлов heatmap.
- Раз в день workflow `strava heatmap check` запрашивает тайл через прокси и падает, если `X-Strava-Cookies` не `session` ([ci-cd.md](ci-cd.md)).
- Решения — архив [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md) и [add-strava-anonymous-fallback](../../openspec/changes/archive/2026-10-08-add-strava-anonymous-fallback/design.md); порядок обновления секрета и диагностика — `AGENTS.md`, [«Публичный клон на Cloudflare»](../../AGENTS.md#публичный-клон-на-cloudflare); срок сессии — backlog, «Отложено».

## Сверено по

[workers/cors-proxy/src/index.js](../../workers/cors-proxy/src/index.js), [workers/cors-proxy/src/strava.js](../../workers/cors-proxy/src/strava.js), [workers/cors-proxy/wrangler.toml](../../workers/cors-proxy/wrangler.toml), [src/lib/CORSProxy/index.js](../../src/lib/CORSProxy/index.js), [src/layers.js](../../src/layers.js), [strava-heatmap-check.yml](../../.github/workflows/strava-heatmap-check.yml).
