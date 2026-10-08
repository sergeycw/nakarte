# CI/CD и данные

Уровень выше: [общая схема](README.md#общая-схема), блок ⑦.

Все workflow лежат в [.github/workflows/](../../.github/workflows/). Проверки идут на PR и push в `master`, деплой — на push в `master` только изменённых сервисов, данные заливаются по расписанию или вручную. Поведение деплоя — спека [clone-deploy](../../openspec/specs/clone-deploy/spec.md), синхронизации тайлов — [tile-sync](../../openspec/specs/tile-sync/spec.md); ручной деплой как запасной путь — `AGENTS.md`, [«Публичный клон на Cloudflare»](../../AGENTS.md#публичный-клон-на-cloudflare).

## Проверки и деплой

```mermaid
flowchart LR
    pr(["pull_request"])
    push(["push в master"])
    cron1(["cron 03:15 UTC ежедневно"])

    check["check (main.yml)<br/>lint, build default, karma"]
    cclone["check clone<br/>сборка клона, адреса автора"]
    cproxy["check cors proxy"]
    ctracks["check tracks"]
    ctiles["check tiles"]
    celev["check elevation"]
    changes["deploy pages: changes<br/>diff с последним успешным деплоем"]
    djobs["deploy pages: job на Worker<br/>npm test / cargo test, wrangler deploy"]
    dpages["deploy pages: pages<br/>тесты functions, сборка, wrangler pages deploy"]

    ghcr["ghcr.io<br/>brouter:nightly"]
    pages["Pages nakarte-routing<br/>статика + functions/"]
    workers["Worker'ы nakarte-cors-proxy,<br/>nakarte-tracks, nakarte-elevation"]

    pr --> check
    push --> check
    cron1 --> check
    pr -->|"кроме docs/, openspec/, *.md"| cclone
    pr -->|"paths: workers/cors-proxy/**"| cproxy
    pr -->|"paths: workers/tracks/**"| ctracks
    pr -->|"paths: workers/tiles/**, functions/**"| ctiles
    pr -->|"paths: workers/elevation/**"| celev
    push -->|"те же paths"| cproxy & ctracks & ctiles & celev
    push --> changes
    changes -->|"workers/<сервис>/ менялся"| djobs
    changes -->|"менялось не только docs/, openspec/, test/, workers/<сервис>/"| dpages
    djobs -->|"после Worker'ов"| dpages
    djobs --> workers
    ghcr -->|"docker create, build.sh:<br/>jar и профили движка"| dpages
    dpages --> pages
```

Job `changes` в [deploy-pages.yml](../../.github/workflows/deploy-pages.yml) сравнивает `HEAD` с коммитом последнего успешного прогона `deploy pages`, а не с предыдущим push: изменения прогона, отменённого новым push (`cancel-in-progress`) или упавшего, выкатит следующий. Ручной запуск, правка самого workflow или неизвестная база — выкатывается всё. Job каждого Worker'а гоняет тесты сервиса и деплоит его; `pages` идёт после них и не идёт, если деплой Worker'а упал. Шаги `pages`: тесты Pages Functions → шаблон секретов → ключ Google из секрета → `yarnpkg` → файлы движка из образа → `npm run build` с `NAKARTE_TARGET=clone` → проверка, что файлы движка в сборке → проверка бандла на адреса автора ([protection.md](protection.md)) → публикация Pages. Проверки `check` и `check-<сервис>` деплой не ждёт: karma ходит в живые сервисы импорта и к клону не относится ([add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md), «Non-Goals»). Ту же проверку бандла до merge делает `check clone`.

Тайлы BRouter (`workers/tiles`) отдельным Worker'ом не деплоятся: их код подключён как Pages Function [functions/tiles](../../functions/tiles/[[path]].js) и уходит с Pages; [workers/tiles/wrangler.toml](../../workers/tiles/wrangler.toml) нужен только локальному `wrangler dev`.

## Данные и мониторинг

```mermaid
flowchart LR
    cron2(["cron пн 04:00 UTC"])
    cron3(["cron 05:17 UTC ежедневно"])
    manual(["workflow_dispatch"])

    sync["brouter tiles sync<br/>brouter-tiles-sync.mjs"]
    edata["elevation data<br/>elevation-data.sh"]
    etiles["elevation tiles<br/>elevation-tiles.sh"]
    scheck["strava heatmap check"]
    pcheck["prod check<br/>scripts/prod-check.sh"]
    cron4(["cron 05:40 UTC ежедневно,<br/>после деплоя"])
    own["Свои сервисы клона:<br/>Pages, высоты, треки, прокси"]

    brouterde["brouter.de<br/>segments4, lookups.dat"]
    vfp["viewfinderpanoramas.org"]
    r2tiles[("R2 nakarte-tiles")]
    r2elev[("R2 nakarte-elevation")]
    proxy["Worker nakarte-cors-proxy"]
    mail(["письмо GitHub при падении"])

    cron2 --> sync
    manual -->|"only = тайлы"| sync
    manual -->|"zips"| edata
    manual -->|"bbox"| etiles
    cron3 --> scheck
    manual --> scheck
    brouterde -->|"индекс, *.rd5"| sync
    sync -->|"wrangler r2 object put --remote,<br/>manifest.json"| r2tiles
    vfp -->|"zip HGT"| edata
    edata -->|"S3 API: dem3/*"| r2elev
    r2elev -->|"S3 API: dem3/*"| etiles
    etiles -->|"S3 API: tiles/elevation-z0-9"| r2elev
    scheck -->|"GET тайла heatmap,<br/>X-Strava-Cookies = session?"| proxy
    scheck -.-> mail
    cron4 --> pcheck
    manual --> pcheck
    pcheck -->|"только чтение: Range, точка высоты,<br/>тайлы высот, 404 трека, preflight прокси"| own
    pcheck -.-> mail
```

| Workflow | Когда | Что делает | Куда |
|---|---|---|---|
| `check` ([main.yml](../../.github/workflows/main.yml)) | PR, push в `master`, ежедневно 03:15 UTC | lint, сборка default, karma в Firefox 52 ESR, Firefox latest, Chrome | — |
| `check cors proxy`, `check tracks`, `check tiles` | PR и push с изменениями в каталоге сервиса (`check tiles` — ещё и в `functions/`) | `vitest` в `workerd` | — |
| `check elevation` | PR и push с изменениями в `workers/elevation/` | `cargo fmt`, `clippy` (и под wasm32), `cargo test`, `npm test` в `workerd` | — |
| `check clone` | PR, кроме правок только в `docs/`, `openspec/`, `*.md` | сборка клона и проверка бандла на адреса автора | — |
| `deploy pages` | push в `master` (изменённые сервисы), вручную (всё) | тесты сервиса, сборка клона и деплой | Pages, Worker'ы |
| `brouter tiles sync` | понедельник 04:00 UTC, вручную | инкрементальная синхронизация тайлов | R2 `nakarte-tiles` |
| `elevation data` | вручную | перепаковка HGT в `dem3/*` | R2 `nakarte-elevation` |
| `elevation tiles` | вручную, после обновления `dem3/` | архив тайлов z0–9 | R2 `nakarte-elevation` |
| `strava heatmap check` | ежедневно 05:17 UTC, вручную | тайл heatmap через прокси, падает без `session` | — |
| `prod check` | ежедневно 05:40 UTC, после деплоя (job `smoke`), вручную | `scripts/prod-check.sh`: свои сервисы клона отвечают, только чтение | — |

Расписания GitHub запускает только из ветки по умолчанию. Workflow с записью в Cloudflare и R2 ограничены форком условием `github.repository == 'sergeycw/nakarte'`.

## Секреты

| Секрет | Где хранится | Кто использует | Права |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub | `deploy pages`, `brouter tiles sync` | Pages Edit, Workers Scripts Edit, Workers R2 Storage Edit |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub | `deploy pages`, `brouter tiles sync` | — |
| `GOOGLE_MAPS_API_KEY` | GitHub, необязательный | `deploy pages` (подставляется в `src/secrets.js`) | ограничения ключа в Google Cloud |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | GitHub | `elevation data`, `elevation tiles` | Object Read & Write только на `nakarte-elevation` |
| `STRAVA_SESSION`, `STRAVA_COOKIES` | секреты Worker'а `nakarte-cors-proxy` | прокси ([cors-proxy.md](cors-proxy.md)) | — |

Все секреты заводит владелец, агент токены не вводит. Права токенов и порядок заведения — `AGENTS.md`, [«Публичный клон на Cloudflare»](../../AGENTS.md#публичный-клон-на-cloudflare) и [«Сервис высот»](../../AGENTS.md#сервис-высот-workerselevation); утечка и сужение прав — backlog, пункт «Security-аудит клона».

## Сверено по

[.github/workflows/](../../.github/workflows/) (все двенадцать файлов), [scripts/brouter-tiles-sync.mjs](../../scripts/brouter-tiles-sync.mjs), [workers/elevation/scripts/](../../workers/elevation/scripts/), [experiments/wasm/cheerpj/build.sh](../../experiments/wasm/cheerpj/build.sh), [functions/tiles](../../functions/tiles/[[path]].js), [workers/tiles/wrangler.toml](../../workers/tiles/wrangler.toml).
