# Архитектура

Схема приложения сверху вниз: сначала общая картина крупными блоками с ключевыми решениями, потом каждый блок отдельно. Документ показывает структуру и связи, а остальное — ссылкой туда, где оно записано (`AGENTS.md`, раздел «Где что записано»): поведение — `openspec/specs/`, причины решений — архив changes и [реестр решений](decisions.md), запуск и подвохи — `AGENTS.md`, риски — `openspec/backlog.md`.

Диаграммы сверены с кодом на `master` 2026-10-09 (после change `switch-to-web-app`), Worker'ы — с change `retire-old-client-services`. Правишь связь в коде — правь стрелку здесь.

## Общая схема

Что есть в системе, где оно работает и какие решения определяют её форму. Номер блока ведёт в таблицу под схемой.

```mermaid
flowchart LR
    user(["Пользователь"])

    subgraph browser["Браузер"]
        direction TB
        ui["① Клиент<br/>SPA web/ на React + MapLibre:<br/>карта, слои, треки, редактор маршрута"]
        engine["② Прокладка в браузере<br/>BRouter на CheerpJ в Web Worker,<br/>jar как есть; сервера-роутера нет"]
    end

    subgraph cf["Cloudflare: свои сервисы вместо *.nakarte.me"]
        direction TB
        pages["③ Pages + Functions<br/>сайт; jar и тайлы BRouter<br/>по Range с того же origin"]
        elev["⑥ Сервис высот, Rust<br/>DEM 3″ как у автора"]
        tracks["⑤ Хранилище треков<br/>ссылка nktl= = md5 треков"]
        proxy["④ CORS-прокси<br/>протокол авторского прокси;<br/>куки Strava держит прокси"]
    end

    r2[("R2<br/>тайлы BRouter · треки · DEM")]

    subgraph gha["⑦ GitHub Actions"]
        direction TB
        deploy["Деплой на push в master;<br/>бандл без адресов автора"]
        data["Данные: тайлы brouter.de раз в неделю,<br/>DEM viewfinderpanoramas вручную"]
    end

    subgraph ext["Чужие сервисы"]
        direction TB
        maps["Тайлы карт, Street View, поиск photon"]
        sites["Strava, сайты треков, поиск mapy.cz"]
        cdn["CDN CheerpJ"]
    end

    local["⑧ Локальный режим<br/>маршрут на BRouter в docker"]

    user --> ui
    ui --> engine
    engine -->|"Range: jar, *.rd5"| pages
    ui -->|"профиль высот"| elev
    ui -->|"Copy link"| tracks
    ui -->|"чужие сайты"| proxy
    pages --> r2
    elev --> r2
    tracks --> r2
    deploy -->|"wrangler"| cf
    data -->|"заливка"| r2
    ui -->|"тайлы, панорамы, поиск"| maps
    proxy --> sites
    engine -->|"рантайм"| cdn
    ui -.->|"режим без clone"| local
```

| Блок | Ключевое решение | Вглубь | Почему так |
|---|---|---|---|
| ① Клиент | приложение `web/` на `/` (старый клиент автора удалён, `/next/` — редирект); адреса сервисов общие для всех режимов, режим `clone` отличается только движком ([switch-to-web-app](../../openspec/changes/archive/2026-10-09-switch-to-web-app/design.md)) | [client.md](client.md), [route-editor.md](route-editor.md) | [реестр: платформа и стек](decisions.md#платформа-и-стек), [редактор](decisions.md#редактор) |
| ② Прокладка в браузере | маршрут считает BRouter на CheerpJ в Web Worker страницы; сервер только раздаёт файлы | [routing.md](routing.md) | [реестр: прокладка и движок](decisions.md#прокладка-и-движок-в-браузере) |
| ③ Pages + Functions | jar, профили и тайлы BRouter с origin клона по Range: CheerpJ читает только его | [routing.md](routing.md), [уровень 2](#публичный-клон) | [реестр: прокладка и движок](decisions.md#прокладка-и-движок-в-браузере) |
| ④ CORS-прокси | повторяет протокол авторского прокси; куки Strava heatmap прокси получает сам по сессии | [cors-proxy.md](cors-proxy.md) | [реестр: CORS-прокси и Strava](decisions.md#cors-прокси-и-strava) |
| ⑤ Хранилище треков | ссылка `nktl=` — md5 треков, объект в R2 неизменяемый | [track-storage.md](track-storage.md) | [реестр: хранилище треков](decisions.md#хранилище-треков) |
| ⑥ Сервис высот | данные и арифметика автора, Rust → wasm; только API высот, тайлы высот выведены | [elevation.md](elevation.md) | [реестр: сервис высот](decisions.md#сервис-высот) |
| ⑦ GitHub Actions | прод = `master`; данные в R2 заливает CI, а не рантайм; деплой падает на адресах автора | [ci-cd.md](ci-cd.md), [protection.md](protection.md) | [реестр: деплой и защита](decisions.md#деплой-и-защита) |
| ⑧ Локальный режим | то же приложение в режиме без `clone`: `routingEngine: 'server'` и BRouter в docker | [уровень 2](#локальный-режим), [routing.md](routing.md) | `AGENTS.md`, [«Запуск»](../../AGENTS.md#запуск) |
| Cloudflare целиком | свои Worker'ы и R2 вместо `*.nakarte.me`, с лимитами на вызов и частоту | [protection.md](protection.md), [что заменено](#что-больше-не-используется-от-nakarteme) | [реестр: платформа и стек](decisions.md#платформа-и-стек) |

От каких чужих сервисов зависит система и что ломается при отказе каждого — backlog, «Внешние зависимости и риски».

## Уровень 2: контейнеры и запросы

Блоки общей схемы на уровень ниже: каждый сервис и путь запроса с протоколом. Две картинки: публичный клон и локальный режим. Клиент один, режимов сборки два; чем они отличаются — [client.md](client.md).

### Публичный клон

Сборка `vite build --mode clone` на `nakarte-routing.pages.dev`. Маршрут считается в браузере, тайлы BRouter и файлы движка идут с того же origin.

```mermaid
flowchart LR
    subgraph browser["Браузер"]
        spa["SPA, режим clone"]
        engine["Движок CheerpJ в Web Worker<br/>WasmRouter"]
    end

    subgraph pages["Pages nakarte-routing"]
        static["Статика build/"]
        fwasm["Function brouter-wasm"]
        ftiles["Function tiles"]
    end

    subgraph workers["Worker'ы *.nakarte-routing.workers.dev"]
        proxy["nakarte-cors-proxy"]
        tracks["nakarte-tracks"]
        elev["nakarte-elevation"]
        guard["nakarte-guard<br/>без workers.dev"]
    end

    subgraph r2["R2, EEUR"]
        r2tiles[("nakarte-tiles")]
        r2tracks[("nakarte-tracks")]
        r2elev[("nakarte-elevation")]
    end

    cdn["CDN CheerpJ"]
    ext["Внешние сайты и Strava"]

    spa -->|"GET /, /next/* → 302 на /*"| static
    spa --> engine
    engine -->|"GET loader.js, JDK"| cdn
    engine -->|"Range /brouter-wasm/lib/*.jar,<br/>/brouter-wasm/profiles/*"| fwasm
    fwasm -->|"ASSETS.fetch"| static
    engine -->|"Range /tiles/*.rd5"| ftiles
    ftiles -->|"get с range"| r2tiles
    fwasm & ftiles -->|"_middleware: service binding GUARD,<br/>лимит по IP"| guard
    spa -->|"POST, GET /track/{key}"| tracks
    tracks -->|"tracks/{key}"| r2tracks
    spa -->|"POST /"| elev
    elev -->|"range dem3/*"| r2elev
    spa -->|"GET, HEAD /{https}/{host}/…"| proxy
    proxy -->|"fetch, redirect manual"| ext
```

Ресурсы Cloudflare, аккаунт и адреса — `AGENTS.md`, [«Публичный клон на Cloudflare»](../../AGENTS.md#публичный-клон-на-cloudflare).

### Локальный режим

Dev-сервер `web/` на 8769: `npm run dev` — с BRouter в docker, `npm run dev:clone` — движок в браузере. Worker'ы локально нужны только для проверки изменений в них: приложение по умолчанию ходит в боевые Worker'ы (адреса — [config.ts](../../web/src/config.ts)).

```mermaid
flowchart LR
    subgraph browser["Браузер"]
        sdev["npm run dev<br/>localhost:8769"]
        sclone["npm run dev:clone<br/>localhost:8769"]
    end

    brouter["BRouter в docker<br/>127.0.0.1:17777"]
    seg[("brouter/segments4/*.rd5")]
    prof[("brouter/profiles/*.brf")]
    wdtiles["wrangler dev tiles<br/>8788"]
    localr2[("Локальный R2<br/>nakarte-tiles")]
    wdproxy["wrangler dev cors-proxy<br/>8787"]
    wdelev["wrangler dev elevation<br/>8789"]
    prod["Боевые Worker'ы<br/>proxy, tracks, elevation"]

    sdev -->|"GET /brouter?lonlats=…"| brouter
    brouter --> seg
    brouter --> prof
    sclone -->|"Range /tiles/*.rd5<br/>через proxy dev-сервера"| wdtiles
    wdtiles --> localr2
    sdev --> prod
    sclone --> prod
    sclone -. "если corsProxyUrl направлен на 8787" .-> wdproxy
    sclone -. "если elevationsServer направлен на 8789" .-> wdelev
```

Файлы движка (`/brouter-wasm/lib`, `profiles`, а без `clone` и тайлы `/brouter-wasm/segments4/` из `brouter/segments4/`) dev-сервер и `vite preview` отдают с Range сами ([engine-files.ts](../../web/vite/engine-files.ts)). Запуск, порты и подвохи — `AGENTS.md`, [«Запуск»](../../AGENTS.md#запуск) и [«Публичный клон на Cloudflare»](../../AGENTS.md#публичный-клон-на-cloudflare).

## Что больше не используется от `*.nakarte.me`

Клон не ходит в инфраструктуру автора ни в одной функции (требование «Без запросов к инфраструктуре автора» в [clone-hosting](../../openspec/specs/clone-hosting/spec.md)), деплой проверяет это по бандлу ([protection.md](protection.md)).

| Сервис автора | Чем заменён | Источник |
|---|---|---|
| `proxy.nakarte.me` | `nakarte-cors-proxy` | [cors-proxy](../../openspec/specs/cors-proxy/spec.md), [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md) |
| `proxy.nakarte.me/mapy/` (слои mapy.cz) | удалены, не заменены | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md) |
| `tracks.nakarte.me` | `nakarte-tracks` | [track-storage](../../openspec/specs/track-storage/spec.md) |
| `elevation.nakarte.me` | `nakarte-elevation`, `POST /` | [elevation-api](../../openspec/specs/elevation-api/spec.md) |
| `tiles.nakarte.me/elevation` | не заменён: свои тайлы высот выведены вместе со старым клиентом | [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md), [elevation.md](elevation.md#тайлы-высот-выведены) |
| `{s}.tiles.nakarte.me`, `tiles.nakarte.me/topomapper` (сканы карт), `nakarte.me/westraPasses/`, `nakarte.me/geocachingSu/` | слои удалены | [drop-author-scan-layers](../../openspec/changes/archive/2026-10-08-drop-author-scan-layers/design.md) |
| `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` (покрытие панорам) | провайдеры удалены, остался Street View | [remove-panorama-providers](../../openspec/changes/archive/2026-10-08-remove-panorama-providers/design.md) |
| `nakarte.me/event`, Sentry | нет: журнала событий и Sentry в приложении нет | [config.ts](../../web/src/config.ts), [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md) |

## Инвентаризация

Каждый компонент и каждая связь — с файлом, по которому они сверены. Все диаграммы построены по этим таблицам; это справочник для сверки, а не для чтения подряд.

### Компоненты

| Компонент | Что это | Доказательство |
|---|---|---|
| Клиент | SPA `web/` на React + MapLibre, сборка Vite | [vite.config.ts](../../web/vite.config.ts), [App.tsx](../../web/src/App.tsx) |
| Режим без `clone` (серверный) | `makeConfig(mode)`: маршрут на серверном BRouter | [config.ts](../../web/src/config.ts) |
| Режим `clone` | `vite build --mode clone`: движок в браузере, тайлы `/tiles/` | [config.ts](../../web/src/config.ts), [deploy-pages.yml](../../.github/workflows/deploy-pages.yml) |
| Pages-проект `nakarte-routing` | статика `build/` (приложение в корне, файлы движка в `brouter-wasm/`, редирект `/next/` из `_redirects`) и Pages Functions, адрес `nakarte-routing.pages.dev` | [wrangler.toml](../../wrangler.toml), [_redirects](../../web/public/_redirects) |
| Pages Function `tiles` | тайлы BRouter `/tiles/*` из R2 с Range; код — `workers/tiles` | [functions/tiles](../../functions/tiles/[[path]].js), [workers/tiles/src/index.js](../../workers/tiles/src/index.js) |
| Pages Function `brouter-wasm` | Range для файлов движка (jar, профили) поверх статики Pages | [functions/brouter-wasm](../../functions/brouter-wasm/[[path]].js) |
| Worker `nakarte-guard` | счётчик частоты для Pages Functions, снаружи закрыт (`workers_dev = false`) | [workers/guard/wrangler.toml](../../workers/guard/wrangler.toml), [index.js](../../workers/guard/src/index.js), [client.js](../../workers/guard/src/client.js) |
| Worker `nakarte-cors-proxy` | CORS-прокси, куки Strava heatmap | [workers/cors-proxy/wrangler.toml](../../workers/cors-proxy/wrangler.toml), [index.js](../../workers/cors-proxy/src/index.js), [strava.js](../../workers/cors-proxy/src/strava.js) |
| Worker `nakarte-tracks` | хранилище треков для `nktl=` | [workers/tracks/wrangler.toml](../../workers/tracks/wrangler.toml), [index.js](../../workers/tracks/src/index.js) |
| Worker `nakarte-elevation` | API высот (`POST /`), Rust → wasm; тайлов высот нет | [workers/elevation/wrangler.toml](../../workers/elevation/wrangler.toml), [http.rs](../../workers/elevation/core/src/http.rs) |
| R2 `nakarte-tiles` | тайлы BRouter `*.rd5`, `manifest.json` синхронизации | [wrangler.toml](../../wrangler.toml), [brouter-tiles-sync.mjs](../../scripts/brouter-tiles-sync.mjs) |
| R2 `nakarte-tracks` | объекты `tracks/{key}` | [workers/tracks/wrangler.toml](../../workers/tracks/wrangler.toml) |
| R2 `nakarte-elevation` | градусы `dem3/N43E042`; архив тайлов высот `tiles/elevation-z0-9` остаётся до решения владельца, Worker его не читает | [grid.rs](../../workers/elevation/core/src/grid.rs), [elevation.md](elevation.md#тайлы-высот-выведены) |
| BRouter в docker | `ghcr.io/abrensch/brouter:nightly` на `127.0.0.1:17777` | [docker-compose.yml](../../docker-compose.yml) |
| Dev-сервер | 8769 — `npm run dev` и `npm run dev:clone` из `web/`, `vite preview` — 4173 | [web/package.json](../../web/package.json), [vite.config.ts](../../web/vite.config.ts), `../.claude/launch.json` (вне репозитория) |
| Движок в браузере | CheerpJ в Web Worker + `brouter.jar` + патчи + `WasmRouter` | [engine/](../../web/src/engine/), [build.sh](../../experiments/wasm/cheerpj/build.sh) |
| GitHub Actions | проверки, деплой, загрузка данных | [.github/workflows/](../../.github/workflows/) |

### Связи

| Откуда → куда | Протокол и путь | Доказательство |
|---|---|---|
| браузер → Pages | `GET /`, статика сборки; `/next`, `/next/*` → `302` на тот же путь от корня | [wrangler.toml](../../wrangler.toml) (`pages_build_output_dir`), [_redirects](../../web/public/_redirects) |
| движок в браузере → `functions/brouter-wasm` | `Range /brouter-wasm/lib/*.jar`, `/brouter-wasm/profiles/*` | [cheerpj-router.ts](../../web/src/engine/cheerpj-router.ts) (`BASE_DIR`), [engine.worker.ts](../../web/src/engine/engine.worker.ts) |
| движок в браузере → `functions/tiles` | `Range /tiles/*.rd5`, пустой `/tiles/storageconfig.txt` | [config.ts](../../web/src/config.ts) (`routingTilesPath`), [workers/tiles/src/index.js](../../workers/tiles/src/index.js) (`EMPTY_FILES`) |
| `functions/tiles` → R2 `nakarte-tiles` | `TILES.get(key, {range})`, `TILES.head` | [workers/tiles/src/index.js](../../workers/tiles/src/index.js) |
| `functions/*/_middleware.js` → `nakarte-guard` | `GUARD.fetch` с `X-Client-IP`, ответ `204` или `429` | [client.js](../../workers/guard/src/client.js), [wrangler.toml](../../wrangler.toml) (`[[services]]`) |
| браузер → CDN CheerpJ | `GET https://cjrtnc.leaningtech.com/4.3/loader.js`, дальше JDK кусками | [config.ts](../../web/src/config.ts) (`routingEngineRuntimeUrl`) |
| браузер → BRouter в docker | `GET http://localhost:17777/brouter?lonlats=…&profile=…&format=geojson` | [router.ts](../../web/src/routing/router.ts), [brouter.ts](../../web/src/routing/brouter.ts), [config.ts](../../web/src/config.ts) (`routingServer`) |
| браузер → `nakarte-tracks` | `POST /track/{key}`, `GET /track/{key}` | [share.ts](../../web/src/tracks/share.ts), [links.ts](../../web/src/tracks/links.ts) |
| `nakarte-tracks` → R2 `nakarte-tracks` | `head`/`put`/`get` `tracks/{key}` | [workers/tracks/src/index.js](../../workers/tracks/src/index.js) |
| браузер → `nakarte-elevation` | `POST /` (точки построчно) | [api.ts](../../web/src/elevation/api.ts) |
| `nakarte-elevation` → R2 `nakarte-elevation` | range-чтения `dem3/*` | [worker/src/lib.rs](../../workers/elevation/worker/src/lib.rs), [grid.rs](../../workers/elevation/core/src/grid.rs) |
| браузер → `nakarte-cors-proxy` | `GET`/`HEAD /{http,https}/{host}/{path}` | [catalog.ts](../../web/src/layers/catalog.ts), [sources.ts](../../web/src/tracks/sources.ts), [mapycz.ts](../../web/src/search/mapycz.ts), [links.ts](../../web/src/search/links.ts) |
| `nakarte-cors-proxy` → внешние сайты | `fetch(target, {redirect: 'manual'})` | [cors-proxy/src/index.js](../../workers/cors-proxy/src/index.js) (`proxy`) |
| `nakarte-cors-proxy` → Strava | `GET www.strava.com/maps/global-heatmap`, тайлы `content-*.strava.com`, `heatmap-external-{a,b,c}.strava.com` | [strava.js](../../workers/cors-proxy/src/strava.js) |
| браузер → тайловые провайдеры | `GET` тайлов напрямую (большинство слоёв) | [catalog.ts](../../web/src/layers/catalog.ts) |
| браузер → photon.komoot.io | `GET /api/` поиска (запасной к mapy.cz) | [photon.ts](../../web/src/search/photon.ts) |
| браузер → Google | Maps JavaScript API для Street View, тайлы покрытия | [google.ts](../../web/src/streetview/google.ts), [coverage.ts](../../web/src/streetview/coverage.ts) |
| dev-сервер 8769 → `wrangler dev` тайлов 8788 | прокси `/tiles/` | [vite.config.ts](../../web/vite.config.ts) (`server.proxy`) |
| GitHub Actions → Cloudflare | `wrangler pages deploy`, `wrangler deploy`, Pages API (удаление старых деплоев), S3 API R2 (тайлы BRouter и высоты) | [ci-cd.md](ci-cd.md) |

## Сверено по

[web/src/config.ts](../../web/src/config.ts), [web/vite.config.ts](../../web/vite.config.ts), [web/public/_redirects](../../web/public/_redirects), [wrangler.toml](../../wrangler.toml), `workers/*/wrangler.toml`, [functions/](../../functions/), [workers/](../../workers/), [.github/workflows/](../../.github/workflows/), [docker-compose.yml](../../docker-compose.yml), [web/src/engine/](../../web/src/engine/), [web/src/routing/](../../web/src/routing/), [web/src/layers/catalog.ts](../../web/src/layers/catalog.ts), [web/src/search/](../../web/src/search/).
