# Сервис высот

Уровень выше: [общая схема](README.md#общая-схема), блок ⑥.

Worker `nakarte-elevation` ([workers/elevation](../../workers/elevation/)) отвечает на два запроса: API высот (`POST /`, список точек → высоты) для профиля трека и экспорта, и тайлы высот (`GET /tiles/{z}/{x}/{y}`) для высоты и уклона под курсором. Данные и арифметика — как у автора (DEM 3″ viewfinderpanoramas). Поведение — спеки [elevation-api](../../openspec/specs/elevation-api/spec.md) и [elevation-tiles](../../openspec/specs/elevation-tiles/spec.md); решения — архив [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md) и [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md); сборка, проверки и подвохи — `AGENTS.md`, [«Сервис высот»](../../AGENTS.md#сервис-высот-workerselevation).

## Крейты Rust-воркспейса

```mermaid
flowchart LR
    core["elevation-core<br/>разбор, интерполяция, тайлы,<br/>HTTP-ответы, формат dem3, архив"]
    worker["elevation-worker<br/>workers-rs, R2, кеш изолята"]
    server["elevation-server<br/>axum + файлы, запасной путь"]
    repack["elevation-repack<br/>HGT → объект градуса"]
    tiles["elevation-tiles<br/>архив z0–9, прореживание фикстур"]
    zstd["фича encode<br/>нативный zstd"]

    worker --> core
    server --> core
    repack --> core
    tiles --> core
    repack --> zstd
    zstd -.-> core
```

- `core` без ввода-вывода: источник данных — трейт `Source` с чтением диапазона байт объекта ([lib.rs](../../workers/elevation/core/src/lib.rs)); каждый адаптер подставляет свой: R2 в `worker`, файлы в `server`.
- Распаковка кусков в wasm — чистый Rust (`ruzstd`), упаковка — нативный `zstd` за фичей `encode`, поэтому она включена только у `repack` ([Cargo.toml](../../workers/elevation/repack/Cargo.toml)).
- `worker` собирается `worker-build` в `worker/build/index.js` (`[build]` в [wrangler.toml](../../workers/elevation/wrangler.toml)).

## Данные в R2 `nakarte-elevation`

```mermaid
flowchart LR
    vfp["viewfinderpanoramas.org<br/>zip с HGT 3″"]
    data["workflow elevation data<br/>elevation-data.sh + elevation-repack"]
    dem3[("dem3/N43E042 …<br/>объект на градус: заголовок NKE1,<br/>16 кусков 301×301, zstd от дельт")]
    tilesjob["workflow elevation tiles<br/>elevation-tiles.sh + elevation-tiles"]
    archive[("tiles/elevation-z0-9<br/>заголовок NKT1, плотный индекс,<br/>тела тайлов в gzip")]

    vfp -->|"curl zip"| data
    data -->|"S3 API, aws s3 cp"| dem3
    dem3 -->|"aws s3 sync"| tilesjob
    tilesjob -->|"S3 API, один объект"| archive
```

Формат объектов — [format.rs](../../workers/elevation/core/src/format.rs), [grid.rs](../../workers/elevation/core/src/grid.rs) и [archive.rs](../../workers/elevation/core/src/archive.rs); почему такой — design `add-elevation-api` («Формат: объект на градус, куски автора») и `add-elevation-tiles` («Формат архива: плотный индекс»). Workflow и токены — [ci-cd.md](ci-cd.md).

## Запрос к Worker'у

```mermaid
flowchart TD
    req["Запрос"]
    rl{"частота с IP:<br/>TILES_RATE_LIMITER или API_RATE_LIMITER<br/>(API с чужим Origin не считается)"}
    path{"путь"}
    api["POST /<br/>Origin из ALLOWED_ORIGINS, иначе 403;<br/>≤ 10 000 точек, ≤ 250 000 байт,<br/>≤ 512 чтений R2, бюджет чтений по IP"]
    pts["индекс куска по точке → чтение кусков dem3<br/>(каждый кусок один раз) → интерполяция"]
    zoom{"z тайла"}
    live["z10–11 на лету:<br/>z11 — 256×256 из 1–4 кусков,<br/>z10 — 513×513 пикселей z11 и сглаживание"]
    arch["z0–9 из архива:<br/>страница индекса (256 записей) + тело"]
    cache[("ByteCache изолята, до 32 МБ:<br/>заголовки, куски, страницы индекса")]
    r2[("R2 nakarte-elevation")]
    tileresp["gzip, Content-Type octet-stream,<br/>Access-Control-Allow-Origin: *, max-age=86400"]
    apiresp["высоты построчно, CORS для origin"]
    r429["429, Retry-After: 60"]

    req --> rl
    rl -->|"превышен"| r429
    rl -->|"ок"| path
    path -->|"/"| api --> pts --> apiresp
    path -->|"/tiles/{z}/{x}/{y}"| zoom
    zoom -->|"10–11"| live --> tileresp
    zoom -->|"0–9"| arch --> tileresp
    pts --> cache
    live --> cache
    arch --> cache
    cache -->|"промах: range-чтение"| r2
```

- Расчёт пикселя один для генератора архива и для Worker'а ([render.rs](../../workers/elevation/core/src/render.rs), [tile.rs](../../workers/elevation/core/src/tile.rs)), поэтому уровни из архива и на лету согласованы.
- Cache API на `*.workers.dev` не работает, поэтому кеш — в памяти изолята; после перезаливки архива Worker передеплоить (кеш держит страницы старого индекса).
- Клиент: API — [web/src/elevation/api.ts](../../web/src/elevation/api.ts) (профиль высот, GPX с высотами, высота для Google Earth; атрибуция `elevationsAttribution` в [config.ts](../../web/src/config.ts)), [client.md](client.md). У тайлов клиента больше нет: их показывал старый клиент под кнопкой координат, сами тайлы и архив уходят в change `retire-old-client-services`.

## Сверено по

[workers/elevation/Cargo.toml](../../workers/elevation/Cargo.toml) и `Cargo.toml` крейтов, [core/src/http.rs](../../workers/elevation/core/src/http.rs) (`handle`, `rate_group`, `respond_tile`), [core/src/request.rs](../../workers/elevation/core/src/request.rs) (`MAX_POINTS`, `MAX_BODY_BYTES`), [core/src/tile.rs](../../workers/elevation/core/src/tile.rs) (`LIVE_MIN_ZOOM`, `MAX_ZOOM`), [core/src/archive.rs](../../workers/elevation/core/src/archive.rs), [worker/src/lib.rs](../../workers/elevation/worker/src/lib.rs), [wrangler.toml](../../workers/elevation/wrangler.toml), [scripts/](../../workers/elevation/scripts/), [elevation-data.yml](../../.github/workflows/elevation-data.yml), [elevation-tiles.yml](../../.github/workflows/elevation-tiles.yml).
