# CORS-прокси и Strava heatmap

Уровень выше: [общая схема](README.md#общая-схема), блок ④.

Worker `nakarte-cors-proxy` ([workers/cors-proxy](../../workers/cors-proxy/)) повторяет протокол авторского `proxy.nakarte.me`: клиент приписывает к адресу прокси исходный URL (`viaCorsProxy` в [catalog.ts](../../web/src/layers/catalog.ts): `https://host/…` → `<прокси>https/host/…`), прокси забирает ответ и отдаёт его с CORS-заголовками. Через него идут импорт треков по ссылкам ([sources.ts](../../web/src/tracks/sources.ts), `proxied`), поиск mapy.cz ([mapycz.ts](../../web/src/search/mapycz.ts)) и раскрытие коротких ссылок ([links.ts](../../web/src/search/links.ts)), слои Tsvetkov (`Mt`), Strava heatmap и подложка по умолчанию Tracestrack Topo (`Tt`), свои слои с флагом прокси. В общий лимит слоёв (`LAYER_HOSTS`, 1200 в минуту) попадают только хосты слоёв, которые приложение шлёт через прокси: Strava heatmap `content-*.strava.com`, Tsvetkov `maptiles.website.yandexcloud.net` и Tracestrack `tile.tracestrack.com`. Маршрут `/wikimapia/` старого клиента убран change [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md) и отвечает `404`, как любой путь не по формату.

Поведение — спека [cors-proxy](../../openspec/specs/cors-proxy/spec.md); лимиты — [protection.md](protection.md).

## Обработка запроса

```mermaid
flowchart TD
    req["Запрос /{https|http}/{host}/{path}"]
    origin{"Origin или Referer<br/>в ALLOWED_ORIGINS?"}
    role{"хост цели в LAYER_HOSTS: Strava heatmap, Tsvetkov,<br/>Tracestrack (или цель не разобралась)?"}
    rate{"RATE_LIMITER (1200)<br/>по CF-Connecting-IP"}
    other{"OTHER_RATE_LIMITER (300)<br/>по CF-Connecting-IP"}
    options{"OPTIONS?"}
    method{"GET или HEAD?"}
    target{"targetUrl разобрался?"}
    own{"свой адрес:<br/>*.nakarte-routing.workers.dev,<br/>nakarte-routing.pages.dev и поддомены?"}
    tt{"тайл Tracestrack<br/>tile.tracestrack.com/topo__/z/x/y(@2x).webp?"}
    ttkey{"секрет TRACESTRACK_KEY задан?"}
    withkey["запрос клиента отброшен,<br/>?key=TRACESTRACK_KEY"]
    r503["503 Tracestrack key is not set"]
    strava{"тайл heatmap<br/>content-*.strava.com/identified/globalheat/?"}
    cookies["heatmapCookie: куки и их источник"]
    send["fetch(target) методом GET, без тела, redirect manual<br/>заголовки: accept, accept-language,<br/>content-type, range, user-agent (+ cookie)"]
    resp["Ответ клиенту: без set-cookie,<br/>с CORS, Location переписан на прокси,<br/>X-Strava-Cookies для тайлов heatmap,<br/>у тайлов Tracestrack — заголовки по белому списку,<br/>Location без key, своё тело ошибки,<br/>Cache-Control сутки, если своего нет,<br/>на HEAD — без тела"]
    r403["403 Forbidden"]
    r429["429, Retry-After: 60"]
    r204["204 preflight<br/>GET, HEAD, OPTIONS"]
    r405["405"]
    r404["404"]
    r403own["403 Forbidden target"]

    req --> origin
    origin -->|"нет"| r403
    origin -->|"да"| role
    role -->|"да"| rate
    role -->|"нет"| other
    rate -->|"превышен"| r429
    other -->|"превышен"| r429
    rate -->|"ок"| options
    other -->|"ок"| options
    options -->|"да"| r204
    options -->|"нет"| method
    method -->|"нет"| r405
    method -->|"да"| target
    target -->|"нет"| r404
    target -->|"да"| own
    own -->|"да"| r403own
    own -->|"нет"| tt
    tt -->|"да"| ttkey
    ttkey -->|"нет"| r503
    ttkey -->|"да"| withkey --> send
    tt -->|"нет"| strava
    strava -->|"да"| cookies --> send
    strava -->|"нет"| send
    send --> resp
```

Код — `fetch` и `proxy` в [index.js](../../workers/cors-proxy/src/index.js). Почему прокси только читает, закрывает свои адреса и делит лимит по роли хоста — архив [restrict-cors-proxy](../../openspec/changes/archive/2026-10-08-restrict-cors-proxy/design.md). Почему `HEAD` уходит как `GET` и зачем пересылается `User-Agent` — архив [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md); `User-Agent` после ухода Wikimapia оставлен: часть сайтов без него отвечает `403`, а `fetch` из Worker'а своего не ставит; коротким ссылкам mapy.com нужен `GET` вместо `HEAD`. Почему в `ALLOWED_ORIGINS` dev-сервер приложения (8769) и `vite preview` (4173) вместо origin старого клиента и karma — design [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md).

## Ключ Tracestrack

Подложка по умолчанию приложения — растр Tracestrack Topo, тайлы которого отдаются только по ключу API. Ключ — секрет `TRACESTRACK_KEY` Worker'а, клиент его не знает: адрес слоя в [catalog.ts](../../web/src/layers/catalog.ts) — без `key`, прокси подставляет его только в растровые тайлы `topo__` ([tracestrack.js](../../workers/cors-proxy/src/tracestrack.js)), чтобы с поддельным `Origin` через прокси нельзя было тратить квоту на векторные тайлы и API по 6 кредитов. В ответ клиенту ключ не попадает: заголовки тайла — по белому списку, `Location` — без `key`, тело ошибки Tracestrack заменяется своим. Без секрета прокси отвечает `503`, приложение откатывается на OpenStreetMap с тостом; так же — на `403` и `429` Tracestrack (ключ отклонён, квота, лимит). Проверка ключа — ежедневный workflow `tracestrack check` ([ci-cd.md](ci-cd.md)). Решения и шаги владельца — design [add-outdoor-basemap](../../openspec/changes/archive/2026-10-09-add-outdoor-basemap/design.md); поведение — спеки [cors-proxy](../../openspec/specs/cors-proxy/spec.md) («Ключ Tracestrack») и [map-layers](../../openspec/specs/map-layers/spec.md) («Откат подложки Tracestrack на OpenStreetMap»).

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

[workers/cors-proxy/src/index.js](../../workers/cors-proxy/src/index.js), [workers/cors-proxy/src/strava.js](../../workers/cors-proxy/src/strava.js), [workers/cors-proxy/wrangler.toml](../../workers/cors-proxy/wrangler.toml), [web/src/layers/catalog.ts](../../web/src/layers/catalog.ts) (`viaCorsProxy`), [web/src/layers/custom.ts](../../web/src/layers/custom.ts), [web/src/tracks/sources.ts](../../web/src/tracks/sources.ts), [web/src/search/mapycz.ts](../../web/src/search/mapycz.ts), [web/src/search/links.ts](../../web/src/search/links.ts), [strava-heatmap-check.yml](../../.github/workflows/strava-heatmap-check.yml).
