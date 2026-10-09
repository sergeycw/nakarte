# Сервис высот

Уровень выше: [общая схема](README.md#общая-схема), блок ⑥.

Worker `nakarte-elevation` ([workers/elevation](../../workers/elevation/)) отвечает на один запрос: API высот (`POST /`, список точек → высоты) для профиля трека и экспорта. Данные и арифметика — как у автора (DEM 3″ viewfinderpanoramas). Поведение — спека [elevation-api](../../openspec/specs/elevation-api/spec.md); решения — архив [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md); сборка, проверки и подвохи — `AGENTS.md`, [«Сервис высот»](../../AGENTS.md#сервис-высот-workerselevation). Тайлов высот больше нет — раздел [«Тайлы высот выведены»](#тайлы-высот-выведены).

## Крейты Rust-воркспейса

```mermaid
flowchart LR
    core["elevation-core<br/>разбор, интерполяция,<br/>HTTP-ответы, формат dem3"]
    worker["elevation-worker<br/>workers-rs, R2, кеш изолята"]
    server["elevation-server<br/>axum + файлы, запасной путь"]
    repack["elevation-repack<br/>HGT → объект градуса"]
    zstd["фича encode<br/>нативный zstd"]

    worker --> core
    server --> core
    repack --> core
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

    vfp -->|"curl zip"| data
    data -->|"S3 API, aws s3 cp"| dem3
```

Формат объектов — [format.rs](../../workers/elevation/core/src/format.rs) и [grid.rs](../../workers/elevation/core/src/grid.rs); почему такой — design `add-elevation-api` («Формат: объект на градус, куски автора»). Workflow и токены — [ci-cd.md](ci-cd.md). Архив тайлов высот `tiles/elevation-z0-9` в R2 остаётся до решения владельца, Worker его не читает.

## Запрос к Worker'у

```mermaid
flowchart TD
    req["Запрос"]
    rl{"частота с IP: API_RATE_LIMITER<br/>(запрос с чужим Origin или без него не считается)"}
    api["POST /<br/>Origin из ALLOWED_ORIGINS, иначе 403;<br/>не POST — 405, другой путь — 404;<br/>≤ 10 000 точек, ≤ 250 000 байт,<br/>≤ 512 чтений R2, бюджет чтений по IP"]
    pts["индекс куска по точке → чтение кусков dem3<br/>(каждый кусок один раз) → интерполяция"]
    cache[("ByteCache изолята, до 32 МБ:<br/>заголовки и куски")]
    r2[("R2 nakarte-elevation")]
    apiresp["высоты построчно, CORS для origin"]
    r429["429, Retry-After: 60"]

    req --> rl
    rl -->|"превышен"| r429
    rl -->|"ок"| api --> pts --> apiresp
    pts --> cache
    cache -->|"промах: range-чтение"| r2
```

- Cache API на `*.workers.dev` не работает, поэтому кеш — в памяти изолята.
- Клиент: API — [web/src/elevation/api.ts](../../web/src/elevation/api.ts) (профиль высот, GPX с высотами, высота для Google Earth; атрибуция `elevationsAttribution` в [config.ts](../../web/src/config.ts)), [client.md](client.md).

## Тайлы высот выведены

Тайлы высот (`GET /tiles/{z}/{x}/{y}`: z0–9 из архива, z10–11 на лету) показывал только старый клиент — высоту и уклон под курсором. Change [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md) их убрал: нет маршрута `/tiles/`, счётчика `TILES_RATE_LIMITER` (`namespace_id` `1001` свободен), расчёта тайлов в ядре, генератора архива `elevation-tiles` и workflow `elevation tiles`. `GET /tiles/…` теперь обычный запрос к API: без `Origin` — `403`, с разрешённым — `405`. Архив `tiles/elevation-z0-9` в R2 остаётся до решения владельца, Worker его не читает. Как тайлы были устроены — архив [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md).

## Сверено по

[workers/elevation/Cargo.toml](../../workers/elevation/Cargo.toml) и `Cargo.toml` крейтов, [core/src/http.rs](../../workers/elevation/core/src/http.rs) (`handle`, `counts_toward_limit`), [core/src/request.rs](../../workers/elevation/core/src/request.rs) (`MAX_POINTS`, `MAX_BODY_BYTES`), [worker/src/lib.rs](../../workers/elevation/worker/src/lib.rs), [wrangler.toml](../../workers/elevation/wrangler.toml), [scripts/](../../workers/elevation/scripts/), [elevation-data.yml](../../.github/workflows/elevation-data.yml).
