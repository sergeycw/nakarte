# nakarte: форк с прокладкой маршрутов

Форк [wladich/nakarte](https://github.com/wladich/nakarte) (MIT), из которого растёт свой продукт: в апстрим не мерджимся, код автора — справочник (раздел «Апстрим»). Добавлена прокладка маршрута по дорогам и тропам через BRouter: локально через сервер, в публичном клоне https://nakarte-routing.pages.dev — движком прямо в браузере.

## Карта репозитория

- `src/` — клиент (Leaflet + knockout, webpack): `layers.js` — все слои карты, `config.js` — адреса сервисов по умолчанию, `config-target/` — отличия сборки клона, `lib/` — модули (импорт треков — `leaflet.control.track-list/lib/services/`, роутинг — раздел «Где код роутинга»).
- `test/` — karma-тесты клиента, их гоняет `main.yml`.
- `workers/<сервис>/` — Cloudflare Worker'ы: `cors-proxy`, `tracks`, `elevation` (Rust), `tiles` (тайлы BRouter из R2, работает как Pages Function `functions/tiles`). Правила — раздел «Свои бэкенды».
- `functions/` — Pages Functions клона: `tiles` и `brouter-wasm` (Range для файлов движка).
- `scripts/` — сборка (`build.js`), тайлы BRouter (`brouter-*`), проверка бандла на `*.nakarte.me`, секреты Strava, которые заводит владелец (`strava-*-secret.mjs`).
- `experiments/wasm/` — сборка и стенд движка CheerpJ; `brouter/` — профили и тайлы локального BRouter.
- `docs/architecture/` — схема системы: контекст, контейнеры, диаграммы по областям, реестр решений.
- `.github/workflows/` — `main.yml` (`check`, апстрим), `check-<сервис>.yml`, `deploy-pages.yml` (весь клон по push в `master`), ручные и плановые загрузки данных, `strava heatmap check`.

## Где что записано

Каждый факт — в одном месте, из остальных — ссылка:
- поведение — `openspec/specs/`;
- решения и их причины — `openspec/changes/archive/` (не правится);
- структура и связи (кто куда ходит) и реестр решений со ссылками на причины — `docs/architecture/`; поменял связь в коде — поправь диаграмму;
- идеи, отложенное и риски — `openspec/backlog.md`;
- ресёрч под будущие changes — `openspec/research/`; когда его changes сделаны, документ удаляется;
- запуск, окружение, подвохи и карта репозитория — этот файл; `README.md` — только вход для человека.

Работа по [OpenSpec](https://github.com/Fission-AI/OpenSpec): `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`, правила артефактов — `openspec/config.yaml`, проверка — `openspec validate --all --strict`.

## Запуск

`yarn local` поднимает BRouter (`docker-compose.yml`) и dev-сервер на 8765 (порт 8080 занят другим проектом). Превью Claude запускает то же самое через `../.claude/launch.json`.

- Тайлы роутера — `scripts/brouter-segments.sh --help`, лежат в `brouter/segments4/` (в `.gitignore`).
- Свои профили кладутся в `brouter/profiles/<имя>.brf` и запрашиваются как `custom_<имя>`. Встроенные профили лежат в контейнере в `/profiles2`.

Подвохи окружения:
- Образ взят с тегом `nightly`: у `latest` нет сборки под arm64.
- `CUSTOMPROFILESPATH` в compose задан относительным путём. С абсолютным, как в образе по умолчанию, BRouter склеивает его с `/profiles2` и не находит свои профили.
- `src/secrets.js` копируется из `src/secrets.js.template` и разворачивается в `config` после значений по умолчанию, поэтому любое поле там перебивает `src/config.js`.
- Изменения в `track-list.js` и том, что он импортирует, HMR не подхватывает: после правки нужна полная перезагрузка страницы.
- Линт `npm run lint:code` проверяет и `workers/`, и `functions/`: для них в `.eslintrc.js` отдельный override (ES-модули, глобалы рантайма Workers).
- Corepack при запуске `yarn` дописывает в `package.json` поле `packageManager`. Его нужно откатывать: случайная правка, не относящаяся к задаче.
- Тесты karma `test_track_load.js` ходят в живые сервисы через свой прокси (`config.CORSProxyUrl`), поэтому `http://localhost:9876` есть в `ALLOWED_ORIGINS` прокси. Strava, Garmin Connect и Wikiloc из них убраны: сервисы режут запросы не из браузера (backlog, «Отложено»). Один файл: `NODE_ENV=testing npx karma start --single-run --browsers ChromeHeadless test/karma.conf.js --glob ./test/test_track_load.js`.

## Где код роутинга

- `lib/brouter/index.js`: активности, `fetchRoute`, проверка живости, упрощение отрезка (`buildSegmentNodes`).
- `lib/brouter/browser-engine.js`: движок в браузере на CheerpJ.
- `leaflet.control.track-list/track-list.js`: кнопка и меню прокладки, `polyline.router`, сохранение разметки (`serializeRouteMarkup`, `applyRouteMarkup`, `simplifyKeepingWaypoints`).
- `leaflet.polyline-edit/index.js`: модель опорных точек и отрезков, undo/redo.

Подвохи редактора:
- Опорная точка — узел без `_routeLeg`, точка маршрута — с `_routeLeg` (маркер скрыт классом `line-editor-node-marker-hidden`). Все узлы — обычные `L.LatLng` в `_latlngs`.
- При `_drawingDirection === -1` индекс 0 занимает временный узел под курсором. `_fixedNodesRange()` исключает его из поиска соседей.
- Хоткеи истории ловятся на `keydown`: на macOS, пока зажат Cmd, браузер не присылает `keyup` для других клавиш.
- Отпечаток `_historyFingerprint` сравнивает снимки на `stopEdit` и `startEdit`; маршрут, пришедший после `stopEdit`, обновляет отпечаток. Вставка и следующее перетаскивание склеиваются через `_justInsertedNode`.
- `spliceLatLngs` шлёт `nodeschanged` синхронно, и сессия может сохраниться прямо внутри него: `getFixedLatLngs()` зависит от `_drawingDirection`, поэтому направление меняют до правки узлов. Запись сессии на `pagehide` при перезагрузке до IndexedDB может не дойти (в проверке 2026-10-07 не дошла), полагаться на сохранение по `trackschanged`.
- Координаты в nktk округлены по сетке `arcUnit` (~2.4 м), а линия упрощается и при сохранении, и при загрузке, поэтому номера узлов между перезагрузками не стабильны — разметка матчится по ключам координат.

## Проверка в браузере

- Временный узел под курсором создаётся по `mousemove`. Перед каждым кликом по карте наводи курсор, иначе клик падает в `wrapLatLngToTarget` (так ведёт себя и исходный код).
- После перезагрузки панель треков смещается. Координаты кнопок бери из `getBoundingClientRect` с поправкой на масштаб скриншота.
- Видимые и скрытые точки удобно считать по `.line-editor-node-marker-halo` и `.line-editor-node-marker-hidden`.
- Тестовый район: Тбилиси, зум 15, от ~41.687, 44.776 к телебашне Мтацминда.
- Проверка живости BRouter делает GET `/brouter` без параметров и получает 404. Эта строка 404 в консоли ожидаема.
- В клоне первый маршрут после загрузки страницы может ждать 10+ с: прогрев движка не успевает, разрыв со спиннером это маскирует.
- В фоновой вкладке браузерной панели клики `computer` до карты не доходят: трек рисуется событиями `mousemove`/`mousedown`/`mouseup`/`click`, отправленными через JS на `.leaflet-container`. «Copy link» в фоне падает в `prompt()` (`prompt() is not supported`) раньше, чем уходит `POST`: перед проверкой подменить `window.prompt` в этой вкладке, ссылка придёт вторым аргументом.

## Движок в браузере (CheerpJ)

Стенд в `experiments/wasm/`: `routes.json` и `baseline/` — эталоны с серверного BRouter; `serve.mjs` — статика с Range, `/__stats`, прокси рантайма `/cjrt/` и редирект `/redirect/`; `cheerpj/build.sh` достаёт jar и профили из контейнера, собирает `WasmRouter` (повторяет `RouteServer` без сокетов) и патчи из `cheerpj/patch/`; `cheerpj/index.html` — стенд замеров, параметры описаны на самой странице. Исходники BRouter для патчей — ревизия `29898106` из `github.com/abrensch/brouter`. Замеры и альтернативы движку — backlog, «Варианты движка в браузере».

Подвохи CheerpJ, проверенные на практике (в документации их нет):
- В `/app/` нет каталогов: `stat` делается запросом `Range: bytes=0-0`, размер берётся из `Content-Range`, `isDirectory()` всегда `false`. `NodesCache` падает с `segment directory ... does not exist`, отсюда патч. Отрицательный `stat` не кешируется, поэтому в патче проверка префикса `/app/` стоит до `isDirectory()`, иначе ~6 лишних запросов на маршрут.
- `/app/` читает только с origin страницы. Редирект 302 на другой origin с CORS работает, но нужен `Access-Control-Expose-Headers: Content-Range`.
- Сервер обязан отвечать на Range с `206` и `Content-Range`. Статика Cloudflare Pages Range игнорирует и отвечает 200, поэтому есть `functions/brouter-wasm`.
- На страницу разрешён один library-поток: второй `cheerpjRunLibrary` бросает `Only one library thread supported`. Одна инициализация на страницу, запросы в очередь.
- `/str/` плоская: `cheerpOSAddStringFile('/str/a/b')` Java не находит, `/str/b` находит.
- JDK (`11/lib/modules`, 43 МБ кусками через Range) грузится из cross-origin iframe `c.html`: эти запросы не видны ни CDP страницы, ни Claude in Chrome. Для учёта байтов — `rt=proxy` стенда. `performance.measureUserAgentSpecificMemory()` работает только с `COI=1` и `rt=proxy` и видит лишь JS-кучу, память мерить по RSS процесса.
- В фоновой вкладке rAF не тикает: блокировку главного потока мерить через `MessageChannel`-пинг.
- Переполнение стека в CheerpJ приходит как `java.lang.ArithmeticException` без текста, а не как `StackOverflowError`. BRouter ловит `StackOverflowError` в `OsmNodesMap.cleanupPeninsulas`, отсюда патч `patch/btools/mapaccess/OsmNodesMap.java`. `RoutingEngine` пишет в ошибку `getMessage()`, так что исключение без текста превращается в пустой трек без ошибки. Чтобы увидеть стек, создать `RoutingEngine` с непустым `outfileBase` (например `/files/dbg`): тогда он печатает лог и стек в консоль.
- Патчи из `patch/` подменяют классы `brouter.jar` целиком: исходник брать из той же ревизии, что jar, и сверять `javap -p`.

## Публичный клон на Cloudflare

Ресурсы Cloudflare (своего домена нет; аккаунт `S.m.lukashev@gmail.com's Account`, id `1f81a3ec34abfc6581cdd0484bbf56a9`), все бакеты R2 — EEUR:
- Pages-проект `nakarte-routing` (корневой `wrangler.toml`), production-ветка `master`. R2-бакет `nakarte-tiles`: тайлы `*.rd5` и `manifest.json` синхронизации.
- Worker'ы на поддомене `nakarte-routing.workers.dev`, адреса — `src/config.js`: `nakarte-cors-proxy`; `nakarte-tracks` (объекты `tracks/{key}` в бакете `nakarte-tracks`); `nakarte-elevation` (в бакете `nakarte-elevation` объекты градусов `dem3/N43E042`, 26 157 штук ≈ 13 ГБ, и архив тайлов z0–9 `tiles/elevation-z0-9`).
- Нужен Workers Paid: на Free потолок CPU 10 мс на вызов. План включает и оплачивает владелец.
- Локально wrangler залогинен через OAuth (`wrangler login`), у Claude есть MCP `plugin:cloudflare:cloudflare` для API.
- Секреты GitHub `CLOUDFLARE_API_TOKEN` (Pages Edit, Workers Scripts Edit, Workers R2 Storage Edit) и `CLOUDFLARE_ACCOUNT_ID` нужны деплою и синхронизации тайлов. Их заводит владелец, агент токены не вводит.

Сборка и деплой клона вручную — запасной путь, если автодеплой сломан (шаги CI — `deploy-pages.yml`):
- `sh experiments/wasm/cheerpj/build.sh` кладёт jar и профили в `experiments/wasm/cheerpj/`. Работает и с созданным, но не запущенным контейнером: `docker create --name <имя> ghcr.io/abrensch/brouter:nightly`, `BROUTER_CONTAINER=<имя>`, потом `docker rm <имя>`. Запущенный общий `nakarte-brouter` не перезапускать.
- `NAKARTE_TARGET=clone PATH="$PWD/node_modules/.bin:$PATH" node scripts/build.js` — production-сборка с `src/config-target/clone.js`. Без yarn, чтобы corepack не правил `package.json`. Ручная сборка берёт локальный `src/secrets.js` (итог перебивает `config-target`), CI — шаблон. Перед публикацией — `node scripts/check-no-author-hosts.mjs build`.
- `npx wrangler@4 pages deploy build --project-name nakarte-routing --branch master` из корня репозитория (подхватывает `functions/`); прокси — `npx wrangler@4 deploy` из `workers/cors-proxy`; треки — `npm ci --omit=dev && npx wrangler@4 deploy` из `workers/tracks`; высоты — `PATH=/usr/local/bin:$PATH npx wrangler@4 deploy` из `workers/elevation` (собирает wasm сам, нужен `worker-build` в `PATH`).
- Без шагов в Cloudflare: `npx wrangler@4 pages functions build --outdir <tmp>` и `npx wrangler@4 deploy --dry-run` в `workers/cors-proxy`.

Подвохи клона:
- Изменения в `webpack/webpack.config.js` (алиасы, `devServer`) dev-сервер подхватывает только после перезапуска. Симптом: `Cannot find module '~/config-target'` и пустая страница.
- Файлы движка попадают в сборку, только если перед ней отработал `build.sh`; без них сборка проходит молча (`noErrorOnMissing`).
- Синхронизация тайлов локально: `ONLY=E40_N40 node ../../scripts/brouter-tiles-sync.mjs` из `workers/tiles` (пишет в локальный R2). По расписанию Actions запускаются только из ветки по умолчанию; brouter.de обновляет все тайлы разом, значит ≈ 10 ГБ на прогон.
- Strava heatmap (`Sa`, `Sr`, `Sb`, `Sw`) идёт через прокси по сессии из секрета `STRAVA_SESSION`: поведение — спека `cors-proxy`, механика кук — шапка `workers/cors-proxy/src/strava.js`, решения — архив `add-strava-heatmap-refresh`, срок сессии — backlog. Сессию заводит владелец скриптом `scripts/strava-session-secret.mjs` (порядок — в его шапке), запасной секрет `STRAVA_COOKIES` на сутки — `scripts/strava-heatmap-secret.mjs`. Откуда куки, видно по заголовку `X-Strava-Cookies` ответа тайла; workflow `strava heatmap check` раз в день падает, если там не `session`, и GitHub шлёт письмо. Если обновление не прошло, `npx wrangler@4 tail` из `workers/cors-proxy` покажет `strava heatmap cookies not refreshed: <причина>`, а при каждом обновлении — `strava page set-cookie: …` с именами и сроками кук. На подставную сессию Strava отвечает `200` без кук (или `500`), а не редиректом на `/login`.
- Окно Street View без ключа держится на `lib/leaflet.control.panoramas/lib/google/keyless.css`: селекторы завязаны на вёрстку Google, и если водяной знак или негатив вернулись — смотреть DOM `.panorama-container`.

Локальный стек для клона (записи в `../.claude/launch.json`, всё из этого checkout): `nakarte` — серверный режим на 8765 (`yarn local`); `nakarte-wasm` — dev-сервер клона на 8766 с `NAKARTE_TARGET=clone`, поэтому `src/secrets.js` общий и правок под клон не требует; `nakarte-tiles-worker` — `wrangler dev` тайлов на 8788 (dev-сервер проксирует `/tiles` туда); `nakarte-cors-proxy` — `wrangler dev` прокси на 8787, нужен, только если направить `CORSProxyUrl` на него. Тайлы в локальный R2: `wrangler r2 object put nakarte-tiles/<имя>.rd5 --file ../../brouter/segments4/<имя>.rd5 --local` из `workers/tiles`. Файлы движка для 8766 — после `build.sh`.

## Свои бэкенды вместо `*.nakarte.me`

- Адреса своих Worker'ов — значения по умолчанию в `src/config.js`, в `src/config-target/clone.js` только отличия клона (движок в браузере, путь тайлов BRouter). Новый сервис — отдельный change и свой ключ в `src/config.js`.
- Монорепо: сервис живёт в `workers/<сервис>/` со своим `wrangler.toml` и деплоится отдельно, а контракт сервиса (спека) и правка клиента идут одним PR.
- Тесты обязательны. Сервис подключает свои отдельным workflow `.github/workflows/check-<сервис>.yml` с фильтром `paths:`; апстримный `main.yml` (`check`) не трогаем. Тесты клиента — karma в `test/`, их запускает `main.yml`. В сеть и живые сервисы тесты не ходят: ответы внешних сервисов — через фикстуры или заглушки (как не надо — сетевые тесты `test_track_load.js`, которые падали из-за Cloudflare у wikiloc).
- Шаблон сервиса на JS — `workers/tracks/`: свои `package.json`, `package-lock.json` и `.npmrc`, тесты `vitest` + `@cloudflare/vitest-pool-workers` в `workerd` с локальным R2, workflow `check-tracks.yml`, шаг деплоя в `deploy-pages.yml`, ключ в `src/config.js`.
- Тесты сервиса: `PATH=/usr/local/bin:$PATH npm test` из `workers/<сервис>`; внешние запросы прокси в тесте подменяет `outboundService` miniflare в `vitest.config.js`.
- Лимиты Worker'ов — `[limits]` и `[[ratelimits]]` в `wrangler.toml` каждого (поведение — спека `worker-limits`, цифры и решения — архив `add-worker-limits`). `namespace_id` уникален в аккаунте: новому счётчику — следующий за занятыми (они перечислены в комментариях `wrangler.toml`). Без `CF-Connecting-IP` (локальный `wrangler dev`, тесты) лимит не применяется: тест `429` задаёт заголовок сам, а `vitest.config.js` понижает лимиты через `miniflare.ratelimits`.

Подвохи тестового стенда Workers:
- Пулу нужен Node ≥ 22, а по умолчанию здесь nvm-шный Node 20. Node 22 лежит в `/usr/local/bin`, отсюда `PATH=/usr/local/bin:$PATH`.
- `@cloudflare/vitest-pool-workers` 0.22 требует `vitest` 4 (peer `^4.1.0`), с `vitest` 5 не работает. Конфиг — плагин `cloudflareTest()`, а не старый `defineWorkersConfig`. Флаг `nodejs_compat` не нужен.
- Глобальный `~/.npmrc` задаёт `install-strategy=shallow`: зависимости `vitest` оказываются вложенными, и пул падает с `The requested module 'expect-type' does not provide an export named 'expectTypeOf'`. Поэтому у сервиса свой `.npmrc` с `install-strategy=hoisted`, как в CI.
- npm 10 на установке без lock-файла падает с `Cannot read properties of null (reading 'edgesOut')` на цикле peer-зависимостей `vitest`. Ставить `npx --yes npm@11 install`, в CI на Node 24 и так npm 11.
- Апстримный `check` линтит весь репозиторий без `node_modules` сервисов: импорты `vitest` и пула там не резолвятся, поэтому в `.eslintrc.js` они в `ignore` у `import/no-unresolved`. Перед push линт проверять и без `workers/<сервис>/node_modules`.
- В тестах воркер вызывается через `import {exports as workerExports} from 'cloudflare:workers'`: `SELF` из `cloudflare:test` устарел, а имя `exports` ловит линтер (`import/no-commonjs`).

### Сервис высот (`workers/elevation`)

Контракт — спеки `elevation-api` и `elevation-tiles`, формат данных и решения — архив `add-elevation-api` и `add-elevation-tiles`. Данные и арифметика — как у автора: Go-сервер `wladich/elevation_server` (HGT 3″ viewfinderpanoramas, четверти градуса 301×301) и GDAL-генератор тайлов `wladich/elevation_tiles_for_nakarte`.

- Rust-воркспейс: `core` (без ввода-вывода, вся логика и HTTP-ответы, в том числе расчёт тайлов), `worker` (R2), `server` (`axum` + файлы, запасной путь для VPS), `repack` (HGT → объект градуса), `tiles` (`elevation-tiles`: архив тайлов z0–9 и прореживание фикстур). Версию Rust из `rust-toolchain.toml` rustup ставит сам; `worker-build` ставить той же версии, что в `check-elevation.yml`.
- Проверки — шаги `check-elevation.yml` из `workers/elevation`; `npm test` (собирает wasm и гоняет его в `workerd`) — с `PATH=/usr/local/bin:$PATH`.
- Фикстуры: `fixtures/reference.txt` — ответы автора, `fixtures/tiles/{z}-{x}-{y}.gz` — тайлы автора как есть (gzip), `fixtures/dem3/*` — прореженные объекты (только нужные куски). Пересборка API — `fixtures/make_reference.py` (ходит к автору) и `elevation-repack --only ...` по списку, который он печатает; новый эталонный тайл — скачать с `tiles.nakarte.me/elevation` в `fixtures/tiles/` и `elevation-tiles thin --data <каталог с полными dem3> --fixtures fixtures Z/X/Y` (дописывает нужные куски, не трогая уже лежащие).
- Данные: `scripts/elevation-data.sh` (справка — без аргументов; по умолчанию пишет в локальный R2 для `wrangler dev`, `R2_MODE=--remote` — в Cloudflare через S3 API R2) или ручной workflow `elevation data` (весь мир ≈ 40 минут) с секретами `R2_ACCESS_KEY_ID` и `R2_SECRET_ACCESS_KEY` (Account API token R2 «nakarte-elevation data upload»: Object Read & Write только на `nakarte-elevation`, заводит владелец). `wrangler r2 bulk put --remote` для массовой заливки не годится: ~0.4 объекта в секунду.
- Тайлы: z10–11 Worker считает на лету из `dem3`, z0–9 читает из архива. Архив — `DATA=<каталог с dem3> [BBOX=W,S,E,N] scripts/elevation-tiles.sh` (локальный R2) или ручной workflow `elevation tiles` (весь мир через S3 API тем же токеном: ≈ 60 минут, архив ≈ 3.8 ГБ; поле `bbox` — для пробы на регионе). Регион Кавказ `40,41,47,45` локально — 4 секунды.
- Локально: `nakarte-elevation-worker` в `../.claude/launch.json` — `wrangler dev` на 8789 поверх локального R2 (сначала залить градусы скриптом выше, для тайлов z0–9 — ещё архив). Клон на 8766 ходит в боевой Worker; для проверки с локальным временно поставить `elevationsServer: 'http://localhost:8789/'` или `elevationTileUrl: 'http://localhost:8789/tiles/{z}/{x}/{y}'` в `src/config.js` и вернуть. Высота под курсором включается кнопкой координат (`a[title="Show coordinates at cursor"]`), в фоновой вкладке курсор — `mousemove` через JS на `.leaflet-container`, подпись — `.elevation-display-label`.

Подвохи:
- В `workerd` нет файловой системы: тест Worker получает фикстуры привязками из `vitest.config.js`.
- Будущее ядра не `Send` (трейт `Source` без `Send`-границ ради wasm), поэтому `server` крутит его через `spawn_blocking` + `block_on`.
- `core` с фичей `encode` тянет C-шный `zstd`: под wasm32 не собирается, поэтому clippy под wasm — только `-p elevation-worker`.
- Тайлы отдаются уже в gzip (`EncodeBody::Manual`); в тестах `workerd` тело такого ответа при чтении из JS приходит распакованным.
- Узел на стыке градусов есть в двух HGT, и значения там расходятся: тайлы автора берут градус, последний по алфавиту имени, поэтому куски в `render` заполняют окно строго в порядке ключей (`buffered`, не `buffer_unordered`).
- После перезаливки архива тайлов Worker передеплоить: кеш изолята держит страницы старого индекса.

## Апстрим

- Remotes: `origin` — публичный форк `sergeycw/nakarte`, `upstream` — `wladich/nakarte`. `gh` по умолчанию смотрит в форк (`gh repo set-default`), поэтому PR без явного `--repo` открываются в форке, а не у автора.
- `master` форка — рабочая версия, новая работа идёт в отдельных ветках через PR в `master` форка.
- Решение владельца 2026-10-08: строим свой продукт на базе nakarte, PR автору не открываем, в апстрим не мерджимся, регулярного ребейза нет. Апстримные файлы можно править и удалять; неиспользуемый код удалять, а не прятать в `config-target`. `src/config-target/` — только для различий между сборкой клона и локальным серверным режимом.
- Перенос правки автора: `git log master..upstream/master`, смотреть дифф, переносить по одной (cherry-pick или вручную); конфликты modify/delete в удалённых у нас файлах решать удалением.
- У автора есть невлитая ветка `upstream/tracks-routing` (2020): роутинг через BRouter, сервер `route.nakarte.me`, рефакторинг редактора линий с миксина на наследование. Движок он выбрал тот же.
