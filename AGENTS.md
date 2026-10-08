# nakarte: локальный форк с автопрокладкой

Форк [wladich/nakarte](https://github.com/wladich/nakarte) (MIT), из которого растёт свой продукт: в апстрим не мерджимся, код автора — справочник (раздел «Апстрим»). Добавлена прокладка маршрута по дорогам и тропам через BRouter: локально через сервер, в публичном клоне https://nakarte-routing.pages.dev — движком прямо в браузере.

## Спеки и планы: `openspec/`

Проект ведётся по [OpenSpec](https://github.com/Fission-AI/OpenSpec) (CLI `openspec`, Node ≥ 20.19.0). Здесь, в `AGENTS.md`, — только запуск, окружение и подвохи.

- `openspec/specs/` — как система ведёт себя сейчас: `routing`, `browser-routing-engine`, `route-editing`, `clone-hosting`, `clone-deploy`, `cors-proxy`, `tile-sync`, `track-storage`, `elevation-api`, `elevation-tiles`, `worker-limits`.
- `openspec/changes/` — работа в процессе, у каждой `proposal.md`, `design.md`, `tasks.md` и дельта спеков.
- `openspec/backlog.md` — идеи и отложенное, ещё не оформленное в changes, и сравнение вариантов движка.
- `openspec/research/` — ресёрчи, из которых нарезаются changes (например, `own-backends.md` — свои бэкенды вместо `*.nakarte.me`).
- Новая работа: `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive` (скиллы в `.claude/`). Проверка: `openspec validate --all --strict`.
- Язык артефактов — русский, заголовки OpenSpec и SHALL/MUST — английские (`openspec/config.yaml`).

## Запуск

`yarn local` поднимает BRouter (`docker-compose.yml`, порт 17777, слушает только 127.0.0.1) и dev-сервер на 8765 (порт 8080 занят другим проектом). Превью Claude запускает то же самое через `../.claude/launch.json`.

Данные роутера:
- `scripts/brouter-segments.sh`: скачивает тайлы по имени, по bbox или весь мир (~10 ГБ), обновляет уже скачанные и перезапускает контейнер, если что-то обновилось. Справка — `--help`.
- Тайлы 5×5°, имя задаёт юго-западный угол: `E40_N40.rd5` покрывает 40–45° в.д. и 40–45° с.ш. Лежат в `brouter/segments4/` (в `.gitignore`). Сейчас скачана Грузия.
- Свои профили кладутся в `brouter/profiles/<имя>.brf` и запрашиваются как `custom_<имя>`. Встроенные профили лежат в контейнере в `/profiles2`.

Подвохи окружения:
- Образ взят с тегом `nightly`: у `latest` нет сборки под arm64.
- `CUSTOMPROFILESPATH` в compose задан относительным путём. С абсолютным, как в образе по умолчанию, BRouter склеивает его с `/profiles2` и не находит свои профили.
- `src/secrets.js` копируется из `src/secrets.js.template`; в шаблоне только ключ Google (заглушка ломает окно Street View, локально держать `google: ''`). Разворачивается в `config` после значений по умолчанию, поэтому любое поле там перебивает `src/config.js`.
- Изменения в `track-list.js` и том, что он импортирует, HMR не подхватывает: после правки нужна полная перезагрузка страницы.
- Линт: `NODE_ENV=production npx eslint --ext js .` (или `npm run lint:code`). Он линтит и `workers/`, и `functions/`: для них в `.eslintrc.js` отдельный override (ES-модули, глобалы рантайма Workers).
- Хоткеи слоёв (`leaflet.control.layers.hotkeys`) в апстриме не игнорировали Cmd: на маке Cmd+Z переключал слой «Z». Здесь добавлен `e.metaKey` — кандидат на отдельный PR в апстрим.
- Corepack при запуске `yarn` дописывает в `package.json` поле `packageManager`. Его нужно откатывать: случайная правка, не относящаяся к задаче.
- Тесты karma `test_track_load.js` ходят в живые сервисы через свой прокси (`config.CORSProxyUrl` по умолчанию) с `Origin: http://localhost:9876` — он есть в `ALLOWED_ORIGINS` прокси. Strava и Garmin Connect из них убраны: без входа Strava отдаёт `403`, Garmin режет не-браузеры (Cloudflare bot management), а у авторского прокси они проходили только из кеша. Один файл: `NODE_ENV=testing npx karma start --single-run --browsers ChromeHeadless test/karma.conf.js --glob ./test/test_track_load.js`.
- Wikiloc за Cloudflare JS-челленджем: с 2026-10-07 любой запрос не из браузера получает `403` на всех хостах (`www`, `ru`, без поддомена, embed, даже `robots.txt`), напрямую и через авторский прокси, с любым `User-Agent`. Импорт wikiloc поэтому не работает, его сетевые тесты убраны из `test_track_load.js`, код импорта не трогали.

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
- В фоновой вкладке браузерной панели клики `computer` до карты не доходят: трек рисуется событиями `mousemove`/`mousedown`/`mouseup`/`click`, отправленными через JS на `.leaflet-container`. «Copy link» в фоне падает в `prompt()` (`prompt() is not supported`) раньше, чем уходит `POST`: перед проверкой подменить `window.prompt` в этой вкладке, ссылка придёт вторым аргументом.

## Движок в браузере (CheerpJ)

Код эксперимента в `experiments/wasm/`: `routes.json` и `baseline/` — 3 эталонных маршрута × 2 профиля с серверного BRouter; `serve.mjs` — стенд со статикой, Range, `/__stats`, прокси рантайма `/cjrt/` и редиректом `/redirect/`; `cheerpj/build.sh` достаёт jar и профили из контейнера и собирает `WasmRouter` (повторяет `RouteServer` без сокетов) и патч `NodesCache`; `cheerpj/index.html` — стенд замеров (`fs=str|app`, `repeat`, `only`, `rt=proxy`). Исходники BRouter для патчей — ревизия `29898106` из `github.com/abrensch/brouter`.

Замеры CheerpJ 4.3 (2026-10-06): 10 км — 0.3–0.55 с на прогретом движке, сервер в 3–4 раза быстрее; холодный старт ≈ 5–6 с; 0.6–0.8 ГБ RSS на вкладку. Первый маршрут после загрузки страницы может ждать 10+ с: прогрев не успевает, разрыв со спиннером это маскирует.

Подвохи CheerpJ, проверенные на практике (в документации их нет):
- В `/app/` нет каталогов: `stat` делается запросом `Range: bytes=0-0`, размер берётся из `Content-Range`, `isDirectory()` всегда `false`. `NodesCache` падает с `segment directory ... does not exist`, отсюда патч. Отрицательный `stat` не кешируется, поэтому в патче проверка префикса `/app/` стоит до `isDirectory()`, иначе ~6 лишних запросов на маршрут.
- `/app/` читает только с origin страницы. Редирект 302 на другой origin с CORS работает, но нужен `Access-Control-Expose-Headers: Content-Range`.
- Сервер обязан отвечать на Range с `206` и `Content-Range`. Статика Cloudflare Pages Range игнорирует, поэтому есть `functions/brouter-wasm`.
- `StorageConfigHelper` на каждый маршрут читает `<segmentDir>/storageconfig.txt`: отдавать пустой файл, чтобы не было 404.
- На страницу разрешён один library-поток: второй `cheerpjRunLibrary` бросает `Only one library thread supported`. Одна инициализация на страницу, запросы в очередь.
- `/str/` плоская: `cheerpOSAddStringFile('/str/a/b')` Java не находит, `/str/b` находит.
- JDK (`11/lib/modules`, 43 МБ кусками через Range) грузится из cross-origin iframe `c.html`: эти запросы не видны ни CDP страницы, ни Claude in Chrome. Для учёта байтов — `rt=proxy` стенда. `performance.measureUserAgentSpecificMemory()` работает только с `COI=1` и `rt=proxy` и видит лишь JS-кучу, память мерить по RSS процесса.
- В фоновой вкладке rAF не тикает: блокировку главного потока мерить через `MessageChannel`-пинг.
- Переполнение стека в CheerpJ приходит как `java.lang.ArithmeticException` без текста, а не как `StackOverflowError`. BRouter ловит `StackOverflowError` в `OsmNodesMap.cleanupPeninsulas`, отсюда патч `patch/btools/mapaccess/OsmNodesMap.java`. `RoutingEngine` пишет в ошибку `getMessage()`, так что исключение без текста превращается в пустой трек без ошибки. Чтобы увидеть стек, создать `RoutingEngine` с непустым `outfileBase` (например `/files/dbg`): тогда он печатает лог и стек в консоль.
- Патчи из `patch/` подменяют классы `brouter.jar` целиком: исходник брать из той же ревизии, что jar, и сверять `javap -p`.

## Публичный клон на Cloudflare

Своего домена нет, клон живёт на `nakarte-routing.pages.dev`. Каждый push в `master` деплоит его workflow `deploy pages`; в R2 лежат тайлы всего мира (1142), их обновляет `brouter tiles sync` по понедельникам.

Ресурсы Cloudflare (аккаунт `S.m.lukashev@gmail.com's Account`, id `1f81a3ec34abfc6581cdd0484bbf56a9`):
- Pages-проект `nakarte-routing`, production-ветка `master`. Корневой `wrangler.toml` описывает его (`pages_build_output_dir = "build"`, R2-привязка `TILES`). Pages Functions: `functions/tiles` (тайлы из R2) и `functions/brouter-wasm` (Range для jar и профилей).
- R2-бакет `nakarte-tiles` (EEUR): тайлы `*.rd5` и `manifest.json` синхронизации.
- Worker `nakarte-cors-proxy` на поддомене `nakarte-routing.workers.dev`: https://nakarte-cors-proxy.nakarte-routing.workers.dev.
- Worker `nakarte-tracks` (`workers/tracks`) — хранилище треков для ссылок `nktl=`: https://nakarte-tracks.nakarte-routing.workers.dev. Объекты `tracks/{key}` в R2-бакете `nakarte-tracks` (EEUR).
- Worker `nakarte-elevation` (`workers/elevation`, Rust) — высоты для профиля (`POST /`) и тайлы высот под курсором (`GET /tiles/{z}/{x}/{y}`): https://nakarte-elevation.nakarte-routing.workers.dev. Объекты `dem3/N43E042` в R2-бакете `nakarte-elevation` (EEUR), 26 157 градусов ≈ 13 ГБ, заливает ручной workflow `elevation data` (весь мир ≈ 40 минут); там же архив тайлов z0–9 `tiles/elevation-z0-9`, его собирает ручной workflow `elevation tiles`. Нужен Workers Paid: на Free 10 мс CPU.
- Локально wrangler залогинен через OAuth (`wrangler login`), у Claude есть MCP `plugin:cloudflare:cloudflare` для API.
- Секреты GitHub `CLOUDFLARE_API_TOKEN` (Pages Edit, Workers Scripts Edit, Workers R2 Storage Edit) и `CLOUDFLARE_ACCOUNT_ID` нужны деплою и синхронизации тайлов. Их заводит владелец, агент токены не вводит.

Сборка и деплой клона вручную — запасной путь, если автодеплой сломан:
- `sh experiments/wasm/cheerpj/build.sh` кладёт jar и профили в `experiments/wasm/cheerpj/`. Работает и с созданным, но не запущенным контейнером: `docker create --name <имя> ghcr.io/abrensch/brouter:nightly`, `BROUTER_CONTAINER=<имя>`, потом `docker rm <имя>`. Запущенный общий `nakarte-brouter` не перезапускать.
- `NAKARTE_TARGET=clone PATH="$PWD/node_modules/.bin:$PATH" node scripts/build.js` — production-сборка с `src/config-target/clone.js`. Без yarn, чтобы corepack не правил `package.json`.
- `npx wrangler@4 pages deploy build --project-name nakarte-routing --branch master` из корня репозитория (подхватывает `functions/`); прокси — `npx wrangler@4 deploy` из `workers/cors-proxy`; треки — `npm ci --omit=dev && npx wrangler@4 deploy` из `workers/tracks`; высоты — `PATH=/usr/local/bin:$PATH npx wrangler@4 deploy` из `workers/elevation` (собирает wasm сам, нужен `worker-build` в `PATH`).
- Ручная сборка берёт локальный `src/secrets.js` (итог перебивает `config-target`). CI собирает с `secrets.js.template`. После сборки деплой гоняет `node scripts/check-no-author-hosts.mjs build`: адрес `*.nakarte.me` в бандле, кроме строк-метаданных (`<title>`, `creator` в GPX, имя JNX, уведомление сессий), останавливает деплой.
- Без шагов в Cloudflare: `npx wrangler@4 pages functions build --outdir <tmp>` и `npx wrangler@4 deploy --dry-run` в `workers/cors-proxy`.

Подвохи клона:
- Изменения в `webpack/webpack.config.js` (алиасы, `devServer`) dev-сервер подхватывает только после перезапуска. Симптом: `Cannot find module '~/config-target'` и пустая страница.
- Статика Pages игнорирует Range и отвечает 200, отсюда `functions/brouter-wasm`. Проверка: `curl -r 0-0` должен дать `206` и `Content-Range`.
- Файлы движка попадают в сборку, только если перед ней отработал `build.sh`; без них сборка проходит молча (`noErrorOnMissing`).
- Профили и `lookups.dat` движка берутся из образа `brouter:nightly`, а тайлы — с brouter.de. Сейчас `lookups.dat` совпадают побайтно; синхронизация падает, если сменится `lookups.dat` на brouter.de, но не сравнивает его с образом.
- Синхронизация тайлов локально: `ONLY=E40_N40 node ../../scripts/brouter-tiles-sync.mjs` из `workers/tiles` (пишет в локальный R2). По расписанию Actions запускаются только из ветки по умолчанию; brouter.de обновляет все тайлы разом, значит ≈ 10 ГБ на прогон.
- Слои Google — тайлы без ключа, работают. Слоёв mapy.cz нет (`drop-author-services`): ключа mapy.cz нет, поиск mapy.cz идёт через свой прокси.
- Слои Strava heatmap (`Sa`, `Sr`, `Sb`, `Sw`) работают через прокси: тайлы `content-*.strava.com/identified/globalheat/` CloudFront отдаёт только с куками `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` и `_strava_idcf` вошедшего аккаунта (без `_strava_idcf` функция CloudFront отвечает 401), живут они около суток. Их ставит сам ответ HTML-страницы `www.strava.com/maps/global-heatmap` (найдено 2026-10-08), поэтому прокси держит секрет `STRAVA_SESSION` — куки сессии Strava в форме заголовка `Cookie`, хватает одной `_strava4_session` (проверено 2026-10-08), — и сам запрашивает эту страницу, когда куки кончаются (`workers/cors-proxy/src/strava.js`, решения — `openspec/changes/archive/*-add-strava-heatmap-refresh/design.md`). Куки держатся в памяти изолята, KV нет. Запасной секрет `STRAVA_COOKIES` — готовые четыре куки — подставляется, пока свежих кук по сессии нет. Ответ на тайл несёт `X-Strava-Cookies: session|fallback|none`: откуда куки, без значений. Сессию заводит владелец: на strava.com (вошедшим) открыть Global Heatmap, DevTools → Network → запрос `global-heatmap` → Request Headers → Cookie → Copy value, потом из корня `pbpaste | PATH=/usr/local/bin:$PATH node scripts/strava-session-secret.mjs` (wrangler нужен Node 22): скрипт оставит только куки сессии, сначала локально получит куки heatmap тем же кодом, что прокси (печатает имена и срок), положит секрет и проверит тайл через прокси до `X-Strava-Cookies: session`. Если обновление не прошло, `npx wrangler@4 tail` из `workers/cors-proxy` покажет `strava heatmap cookies not refreshed: <причина>` (только статус и имена кук); после неудачи прокси 10 минут не повторяет. При каждом обновлении журнал пишет `strava page set-cookie: …` — имена и сроки (`Expires`/`Max-Age`) всех кук ответа без значений: по нему видно, продлевает ли Strava `_strava4_session`. Workflow `strava heatmap check` (`.github/workflows/strava-heatmap-check.yml`) раз в день запрашивает тайл через прокси и падает, если `X-Strava-Cookies` не `session`, — GitHub шлёт письмо. На подставную сессию Strava отвечает `200` без кук (или `500`), а не редиректом на `/login`. Ручной запасной путь — `scripts/strava-heatmap-secret.mjs` кладёт `STRAVA_COOKIES` из заголовка `Cookie` тайла `globalheat` (живут около суток). Странице strava.com эти куки не видны (`document.cookie`, кроме `_strava_CloudFront-Expires`), а с чужого сайта браузер их не шлёт, поэтому грузить тайлы прямо из браузера пользователя мимо прокси нельзя (проверено 2026-10-08).
- Прокси пересылает `User-Agent` клиента (без него nginx Wikimapia отвечает `403`) и шлёт `HEAD` к сервису как `GET` (как nginx автора; mapy.com на `HEAD` коротких ссылок отвечает `404`).
- Слоёв на данных автора в коде нет ни в одной сборке (`drop-author-scan-layers`): 17 сканов на `tiles.nakarte.me`, перевалы Вестры (`Wp`) и geocaching.su (`Gc`). Их коды в старых ссылках `l=` и в `leafletLayersSettings` контрол слоёв игнорирует, это закрепляет `test/test_removed_layers.js`. Свои данные перевалов и геокешинга — `openspec/backlog.md`.
- В панорамах только Google Street View: провайдеры Wikimedia Commons, Mapillary и mapy.cz и зависимость `mapillary-js` удалены из кода (`remove-panorama-providers`), при ребейзе на апстрим их правки дают конфликт modify/delete — решать удалением. Ключ Google, как у nakarte.me, пустой: Maps JavaScript API работает без ключа в режиме разработки Google, а `lib/google/keyless.css` под классом `google-street-view-keyless` (ставится только при пустом ключе) прячет негатив, водяной знак и окно Google, как боевой CSS nakarte.me. Селекторы завязаны на вёрстку Google: если знак или негатив вернулись — смотреть DOM `.panorama-container`. Деплой пишет в `google` секрет `GOOGLE_MAPS_API_KEY` или пустую строку; заглушка `XXXX…` из шаблона ломает окно совсем, поэтому в локальном `src/secrets.js` тоже держать `google: ''`.

Локальный стек для клона (записи в `../.claude/launch.json`, всё из этого checkout): `nakarte` — серверный режим на 8765 (`yarn local`); `nakarte-wasm` — dev-сервер клона на 8766 с `NAKARTE_TARGET=clone`, поэтому `src/secrets.js` общий и правок под клон не требует; `nakarte-tiles-worker` — `wrangler dev` тайлов на 8788 (dev-сервер проксирует `/tiles` туда); `nakarte-cors-proxy` — `wrangler dev` прокси на 8787, нужен, только если направить `CORSProxyUrl` на него. Тайлы в локальный R2: `wrangler r2 object put nakarte-tiles/<имя>.rd5 --file ../../brouter/segments4/<имя>.rd5 --local` из `workers/tiles`. Файлы движка для 8766 — после `build.sh`.

## Свои бэкенды вместо `*.nakarte.me`

- Карта бэкендов, контракты, решения и план — `openspec/research/own-backends.md`.
- Приложение не ходит в `*.nakarte.me` ни в одной сборке (`drop-author-services`): адреса своих Worker'ов — значения по умолчанию в `src/config.js`, в `src/config-target/clone.js` только отличия клона (движок в браузере, путь тайлов BRouter). Новый сервис — отдельный change и свой ключ в `src/config.js`.
- Монорепо: сервис живёт в `workers/<сервис>/` со своим `wrangler.toml` (раскладка — в `own-backends.md`, раздел «Структура репозитория»).
- Тесты обязательны. Сервис подключает свои отдельным workflow `.github/workflows/check-<сервис>.yml` с фильтром `paths:`; апстримный `main.yml` (`check`) не трогаем. Тесты клиента — karma в `test/`, их запускает `main.yml`. В сеть и живые сервисы они не ходят: ответы внешних сервисов — через фикстуры или заглушки (пример, как не надо, — тесты wikiloc, упавшие из-за Cloudflare).
- Шаблон сервиса на JS — `workers/tracks/`: свой `package.json` и `package-lock.json`, тесты `vitest` + `@cloudflare/vitest-pool-workers` в `workerd` с локальным R2 (`vitest.config.js` берёт привязки из `wrangler.toml`), workflow `check-tracks.yml`, шаг деплоя в `deploy-pages.yml` после `npm ci --omit=dev`, ключ в `src/config-target/clone.js`.
- Запуск тестов сервиса: `PATH=/usr/local/bin:$PATH npm test` из `workers/<сервис>`. Тесты есть у `tracks`, `elevation` и `cors-proxy` (свои `check-*.yml`); внешние запросы прокси в тесте подменяет `outboundService` miniflare в `vitest.config.js`.
- Лимиты Worker'ов — в `wrangler.toml` каждого (решения и цифры — `openspec/specs/worker-limits` и `openspec/changes/archive/2026-10-07-add-worker-limits/design.md`): `[limits]` — потолок CPU и подзапросов на вызов, `[[ratelimits]]` — запросов с одного IP (`CF-Connecting-IP`) за 60 с, сверх лимита `429` с `Retry-After: 60` и CORS сервиса. `namespace_id` 1001–1004 заняты (тайлы высот, API высот, треки, прокси), новому счётчику — следующий. Без `CF-Connecting-IP` (локальный `wrangler dev`, тесты) лимит не применяется; тест `429` задаёт заголовок сам, а `vitest.config.js` понижает лимиты через `miniflare.ratelimits`. Поднять лимит — правка `wrangler.toml` и деплой.

Подвохи тестового стенда Workers:
- Пулу нужен Node ≥ 22, а по умолчанию здесь nvm-шный Node 20. Node 22 лежит в `/usr/local/bin`, отсюда `PATH=/usr/local/bin:$PATH`.
- `@cloudflare/vitest-pool-workers` 0.22 требует `vitest` 4 (peer `^4.1.0`), с `vitest` 5 не работает. Конфиг — плагин `cloudflareTest()`, а не старый `defineWorkersConfig`. Флаг `nodejs_compat` не нужен.
- Глобальный `~/.npmrc` задаёт `install-strategy=shallow`: зависимости `vitest` оказываются вложенными, и пул падает с `The requested module 'expect-type' does not provide an export named 'expectTypeOf'`. Поэтому у сервиса свой `.npmrc` с `install-strategy=hoisted`, как в CI.
- npm 10 на установке без lock-файла падает с `Cannot read properties of null (reading 'edgesOut')` на цикле peer-зависимостей `vitest`. Ставить `npx --yes npm@11 install`, в CI на Node 24 и так npm 11.
- Апстримный `check` линтит весь репозиторий без `node_modules` сервисов: импорты `vitest` и пула там не резолвятся, поэтому в `.eslintrc.js` они в `ignore` у `import/no-unresolved`. Перед push линт проверять и без `workers/<сервис>/node_modules`.
- В тестах воркер вызывается через `import {exports as workerExports} from 'cloudflare:workers'`: `SELF` из `cloudflare:test` устарел, а имя `exports` ловит линтер (`import/no-commonjs`).

### Сервис высот (`workers/elevation`)

Контракт — `openspec/specs/elevation-api` и `openspec/specs/elevation-tiles`, формат данных и решения — `openspec/changes/archive/2026-10-07-add-elevation-api/design.md` и `openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md`. Коротко: те же данные и арифметика, что у автора — Go-сервера `wladich/elevation_server` (HGT 3″ viewfinderpanoramas, четверти градуса 301×301) и GDAL-генератора тайлов `wladich/elevation_tiles_for_nakarte`, поэтому ответы и тайлы совпадают побайтно.

- Rust-воркспейс: `core` (без ввода-вывода, вся логика и HTTP-ответы, в том числе расчёт тайлов), `worker` (R2), `server` (`axum` + файлы, запасной путь для VPS), `repack` (HGT → объект градуса), `tiles` (`elevation-tiles`: архив тайлов z0–9 и прореживание фикстур). Версия Rust закреплена в `rust-toolchain.toml`, rustup ставит её сам; нужен `cargo install worker-build --version 0.8.7 --locked`.
- Проверки из `workers/elevation`: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo clippy -p elevation-worker --target wasm32-unknown-unknown -- -D warnings`, `cargo test --workspace`, `PATH=/usr/local/bin:$PATH npm test` (собирает wasm и гоняет его в `workerd`).
- Фикстуры: `fixtures/reference.txt` — 306 ответов автора, `fixtures/tiles/{z}-{x}-{y}.gz` — тайлы автора как есть (gzip), `fixtures/dem3/*` — прореженные объекты (только нужные куски). Пересборка API — `fixtures/make_reference.py` (ходит к автору) и `elevation-repack --only ...` по списку, который он печатает; новый эталонный тайл — скачать с `tiles.nakarte.me/elevation` в `fixtures/tiles/` и `elevation-tiles thin --data <каталог с полными dem3> --fixtures fixtures Z/X/Y` (дописывает нужные куски, не трогая уже лежащие).
- Данные: `scripts/elevation-data.sh dem3/K38 ...` или `all` (справка — без аргументов). По умолчанию пишет в локальный R2 для `wrangler dev`; `R2_MODE=--remote` — в Cloudflare через S3 API R2, уже залитые градусы пропускает. В CI — workflow `elevation data` с секретами `R2_ACCESS_KEY_ID` и `R2_SECRET_ACCESS_KEY` (Account API token R2 «nakarte-elevation data upload»: Object Read & Write только на `nakarte-elevation`, заводит владелец). `wrangler r2 bulk put --remote` для массовой заливки не годится: ~0.4 объекта в секунду.
- Тайлы: z10–11 Worker считает на лету из `dem3`, z0–9 читает из архива. Архив — `DATA=<каталог с dem3> [BBOX=W,S,E,N] scripts/elevation-tiles.sh` (локальный R2) или workflow `elevation tiles` (весь мир через S3 API тем же токеном: ≈ 60 минут, архив ≈ 3.8 ГБ; поле `bbox` — для пробы на регионе). Регион Кавказ `40,41,47,45` локально — 4 секунды.
- Локально: `nakarte-elevation-worker` в `../.claude/launch.json` — `wrangler dev` на 8789 поверх локального R2 (сначала залить градусы скриптом выше, для тайлов z0–9 — ещё архив). Клон на 8766 ходит в боевой Worker; для проверки с локальным временно поставить `elevationsServer: 'http://localhost:8789/'` или `elevationTileUrl: 'http://localhost:8789/tiles/{z}/{x}/{y}'` в `src/config.js` и вернуть. Высота под курсором включается кнопкой координат (`a[title="Show coordinates at cursor"]`), в фоновой вкладке курсор — `mousemove` через JS на `.leaflet-container`, подпись — `.elevation-display-label`.

Подвохи:
- `worker-build` пишет JS-обёртку и wasm в `worker/build/`: каталог в `.gitignore`, eslint его пропускает по `ignorePatterns: ['build']`. Обёртка минифицирована, линтить её нельзя.
- Cache API на `*.workers.dev` не работает, поэтому кеш кусков — в памяти изолята.
- В `workerd` нет файловой системы: тест Worker получает фикстуры привязками из `vitest.config.js`.
- Будущее ядра не `Send` (трейт `Source` без `Send`-границ ради wasm), поэтому `server` крутит его через `spawn_blocking` + `block_on`.
- `core` с фичей `encode` тянет C-шный `zstd`: под wasm32 не собирается, поэтому clippy под wasm — только `-p elevation-worker`.
- Тайлы отдаются уже в gzip: в Worker ответ с `EncodeBody::Manual`, иначе рантайм сожмёт ещё раз. В тестах `workerd` тело такого ответа при чтении из JS приходит распакованным.
- Узел на стыке градусов есть в двух HGT, и значения там расходятся: тайлы автора берут градус, последний по алфавиту имени, поэтому куски в `render` заполняют окно строго в порядке ключей (`buffered`, не `buffer_unordered`).
- После перезаливки архива тайлов Worker передеплоить: кеш изолята держит страницы старого индекса.
- Тест генератора считает растр блока z5 (16 447²): `core` и `tiles` в тестовом профиле собираются с `opt-level = 3`, иначе десятки секунд.

## Апстрим

- Remotes: `origin` — публичный форк `sergeycw/nakarte`, `upstream` — `wladich/nakarte`. `gh` по умолчанию смотрит в форк (`gh repo set-default`), поэтому PR без явного `--repo` открываются в форке, а не у автора.
- Ветки: `master` форка — рабочая версия, локальный `master` следит за `origin/master`. Новая работа идёт в отдельных ветках через PR в `master` форка. Изменения автора подтягиваются из `upstream/master`.
- У автора есть невлитая ветка `upstream/tracks-routing` (2020): роутинг через BRouter, сервер `route.nakarte.me`, рефакторинг редактора линий с миксина на наследование. Движок он выбрал тот же.
- Бэкенды `*.nakarte.me` (высоты, треки, прокси, тайлы) принадлежат автору.
- Вектор развития (решение владельца 2026-10-08): строим свой продукт на базе nakarte. PR автору не открываем и в апстрим не мерджимся; `upstream/master` — справочник: подглядываем в код и выборочно переносим полезные правки (cherry-pick или вручную), регулярного ребейза нет.
- Поэтому правило «дифф с апстримом держим маленьким» снято: апстримные файлы можно править и удалять, неиспользуемый код — удалять, а не прятать в `config-target` (так сделано с провайдерами панорам). `src/config-target/` остаётся для различий между сборкой клона и локальным серверным режимом.
- Перенос правки автора: `git log master..upstream/master`, смотреть дифф, переносить по одной; конфликты modify/delete в удалённых у нас файлах решать удалением.
