# Новый фронтенд клона

Ресёрч 2026-10-08 по пункту «Переписать и обновить UI» из [backlog](../backlog.md), раздел «Глобальное направление». Код не менялся, changes не нарезаны. Владелец ответил на вопросы 2026-10-08 — архив [record-new-ui-decisions](../changes/archive/2026-10-08-record-new-ui-decisions/design.md); открыт один — [слой по умолчанию](#вопросы-владельцу). Разделы ниже уже учитывают ответы. Когда changes из [списка](#changes-по-порядку) сделаны, документ удаляется (`AGENTS.md`, «Где что записано»), а причины решений уходят в архив changes.

Решения владельца не переспрашиваются, они в архиве [record-ui-decisions](../changes/archive/2026-10-08-record-ui-decisions/design.md): только последние браузеры, только светлая тема, главный принцип — красивый, простой и понятный UI, непроложенный отрезок с тостом, ссылки клона (`nktl=`, `nktk=` всех версий, `l=`) читаются, список удаляемых функций, порог VPS. Контракты сервисов не пересказываются — [аудит, п. 2](system-design-audit.md#2-контракты) и [«Что влияет на переписывание UI»](system-design-audit.md#что-влияет-на-переписывание-ui).

Утверждения о текущем клиенте сверены с кодом на `master` (`8e4db7b`). Факты о библиотеках, ценах и лицензиях — из первоисточников, проверены 2026-10-08; версии — из npm registry (`npm view <пакет> version time`). Где факт не подтверждён, так и написано.

## Коротко

- **Стек:** React 19.3 + Vite 8 + TypeScript 7 + Vitest 5 + Biome 2.5 + Playwright, состояние — Zustand и свой модуль адреса. Пожелание владельца подтверждается, с одной оговоркой про Biome ([п. 1](#1-стек)).
- **UI-библиотека:** shadcn/ui на Base UI + Tailwind CSS 4 — выбор владельца ([п. 2](#2-ui-библиотека)).
- **Карта:** MapLibre GL JS 6 вместо Leaflet. Растровые слои переносятся почти все; Яндекс (другая проекция), Wikimapia и сетка советских топокарт в новый UI не идут. Отмывка рельефа — AWS Terrain Tiles. Красивая подложка — свой векторный стиль за $0 или туристический слой Tracestrack Topo; что по умолчанию, не решено ([п. 3](#3-карта)).
- **Движок:** остаётся CheerpJ в браузере. Самый дешёвый годный VPS — ≈ +$4.4–5.2 в месяц, порог владельца он не проходит ([п. 4](#4-движок-прокладки)). Новое — проверить запуск движка в Web Worker, это снимет блокировку страницы.
- **Переход:** новое приложение в `web/`, до готовности живёт на `/next/` того же Pages-проекта, после changes 1–8 встаёт на `/` (без новой подложки), старый клиент удаляется целиком ([п. 7](#7-план-перехода)). Около 18–31 дня работы в 10 changes.

## 1. Стек

**Версии на 2026-10-08** (npm registry):

| Пакет | Версия | Вышла | Что важно |
|---|---|---|---|
| `react`, `react-dom` | 19.3.0 | 2026-09-09 | `<Activity>`, `useEffectEvent` с 19.2; [19.3](https://react.dev/blog/2026/09/09/react-19-3) — `<ViewTransition>` стабилен |
| `vite` | 8.3.4 | 2026-10-08 | с [Vite 8](https://vite.dev/blog/announcing-vite8) (2026-03-12) единственный бандлер — Rolldown; Node 20.19+ / 22.12+; цель сборки по умолчанию `baseline-widely-available` (Chrome 111, Firefox 114, Safari 16.4) — [build options](https://vite.dev/config/build-options) |
| `@vitejs/plugin-react` | 6.1.2 | 2026-10-05 | без Babel, React Refresh на Oxc |
| `typescript` | 7.0.2 | 2026-07-08 | [нативный порт на Go](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), под тегом `latest`; программного API нет до 7.1 |
| `vitest` | 5.0.3 | 2026-09-30 | [Vitest 5](https://vitest.dev/blog/vitest-5.html) требует Node 22.12+; browser mode стабилен с [Vitest 4](https://vitest.dev/blog/vitest-4.html), провайдер `@vitest/browser-playwright` |
| `@biomejs/biome` | 2.5.15 | 2026-09-30 | линт и формат JS/TS/JSX/JSON/CSS — [language support](https://biomejs.dev/internals/language-support/) |
| `@playwright/test` | 1.64.0 | 2026-10-07 | e2e |
| `zustand` | 5.0.15 | 2026-08-13 | состояние |
| Node.js | 24 LTS | — | 26 становится LTS 2026-10-28 ([расписание](https://github.com/nodejs/Release/blob/main/schedule.json)) |

**React + Vite + Vitest** — без оговорок. Альтернативы хуже по экосистеме карты: у Svelte обёртка [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre) сама называет себя экспериментальной, у Solid 2.0 нет даты релиза, совместимость Preact 11 с API React 19 не подтверждена. У React есть зрелая [`react-map-gl` / `@vis.gl/react-maplibre`](https://visgl.github.io/react-map-gl/docs/get-started) 8.1.3. React Compiler стабилен с [1.0](https://react.dev/blog/2025/10/07/react-compiler-1), но в plugin-react 6 путь через Oxc помечен experimental — включать не в первом change.

**TypeScript.** Да, строгий режим. TS 7 подходит именно потому, что программный API нам не нужен: Biome и Vite типы не читают, `tsc --noEmit` — отдельный шаг CI. Если какой-то инструмент потребует API — пакет `@typescript/typescript6` по совету анонса TS 7.

**Biome — с оговоркой.** Работает и стабилен, но type-aware правила (`noFloatingPromises`) ещё в nursery и по замеру самих авторов ловят [≈ 75%](https://biomejs.dev/blog/biome-v2/) того, что находит typescript-eslint; плагины только на GritQL. Главное: [VoidZero](https://blog.cloudflare.com/voidzero-joins-cloudflare) (Vite, Vitest, Rolldown, Oxc) с 2026-06-04 — часть Cloudflare, и их [Vite+ 1.0](https://voidzero.dev/posts/announcing-vite-plus-1-0) собирает oxlint + oxfmt + проверку типов в одну команду, Biome туда не входит. Но `oxfmt` 0.72 ещё до 1.0. Рекомендация: Biome сейчас, как хочет владелец; к Oxc вернуться, когда oxfmt выйдет 1.0 — переезд линтера и форматтера — час работы.

**Состояние и адрес.** Zustand для состояния приложения. Роутер не нужен: страница одна, состояние в `#`. Адрес уже в формате `URLSearchParams` (`getLinkToShare` в [track-list.js](../../src/lib/leaflet.control.track-list/track-list.js)), но значения внутри — свои форматы (`m=zoom/lat/lng`, `l=` через `/`, `nktk`). Свой модуль `hash.ts` разбирает и собирает параметры, синхронизация — `hashchange` + `history.replaceState` с debounce на движение карты. Готовые обёртки не подходят: [nuqs](https://github.com/47ng/nuqs/issues/206) работает только с query string, persist у Zustand пишет JSON.

**Тесты.**

- Unit — Vitest в Node: модули без DOM — разбор `nktk` всех версий, GPX/KML и остальные парсеры, адрес, модель редактора, параметры BRouter. Фикстуры есть: [test/track_load_data](../../test/track_load_data).
- Компоненты и карта — Vitest browser mode в Chromium через Playwright: редактор на настоящей карте, хоткеи, панели.
- e2e — Playwright против `vite preview`: сквозные сценарии спек, без сети (движок и сервисы подменены). Настоящий движок и сервисы проверяет синтетика прода ([clone-monitoring](../specs/clone-monitoring/spec.md)).
- Правило: сценарий спеки ↔ тест с тем же названием, чтобы спека и проверка не расходились.

**CI.** Свой workflow `check-web.yml` с фильтром `paths: web/**`: `biome ci`, `tsc --noEmit`, Vitest (unit и browser), `vite build`, Playwright. Node 24 (с 2026-10-28 можно 26), [`actions/checkout`](https://github.com/actions/checkout/releases) и [`setup-node`](https://github.com/actions/setup-node/releases) v7, браузеры — `npx playwright install --with-deps chromium` ([Playwright CI](https://playwright.dev/docs/ci-intro)). Апстримный `main.yml` с karma и Firefox 52 ESR живёт, пока жив старый клиент, и удаляется вместе с ним ([п. 7](#7-план-перехода)).

## 2. UI-библиотека

Набор для сравнения — Button + Dialog + Popover + Select + Toast, esbuild с минификацией, React вынесен, `gzip -9` (React + ReactDOM ≈ 114 КБ отдельно). Цифры дают порядок, а не бюджет.

| Библиотека | Версия, дата | Стили | Доступность | Тост | JS gzip | Жива ли | Вердикт |
|---|---|---|---|---|---|---|---|
| [shadcn/ui](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) на Base UI | CLI 4.21.4, 2026-10-07 | Tailwind 4, код копируется в проект | [Base UI](https://base-ui.com/react/overview/releases) 1.8 (стабилен с 1.0, 2025-12-11) | свой `Toast` | ≈ 65 КБ + CSS Tailwind | 125 тыс. звёзд, релизы еженедельно | **рекомендую** |
| [Mantine 9](https://mantine.dev/changelog/9-0-0/) | 9.7.1, 2026-10-06 | CSS-файлы и переменные | своя | `@mantine/notifications` | ≈ 65 КБ + 12–41 КБ CSS | 32 тыс., релизы часто | запасной |
| Radix Primitives + Sonner | 1.7.0, 2026-10-05 | без стилей | своя | Sonner | ≈ 47 КБ | живо | основа shadcn по выбору |
| Radix Themes | 3.3.0, 2026-01-31 | готовый CSS 85 КБ | Radix | нет | ≈ 62 КБ | релизы встали | нет |
| React Aria Components | 1.22.0, 2026-10-08 | без стилей | эталонная (Adobe) | [`UNSTABLE_Toast`](https://react-aria.adobe.com/Toast) | ≈ 65 КБ | живо | основа, не готовый вид |
| HeroUI 3 | 3.2.6, 2026-09-17 | Tailwind 4 обязателен | React Aria | есть | ≈ 89 КБ | живо | тяжелее shadcn, лицензия в npm (MIT) и на GitHub (Apache-2.0) расходится |
| Chakra UI 3 | 3.37.0 | Emotion в рантайме | Ark / Zag | есть | ≈ 114 КБ | живо | тяжёлый |
| MUI 9 | 9.4.0 | Emotion | своя | `Snackbar` | ≈ 68 КБ | живо | вид Material, не «просто и красиво» |
| Ant Design 6 | 6.6.5 | CSS-in-JS | своя | есть | ≈ 134 КБ | живо | тяжёлый, корпоративный вид |
| Ark UI / Park UI | 5.39.3 / пресет 2024-11 | без стилей / Panda | Zag | есть | ≈ 50 КБ | Park UI встал | нет |

**Рекомендация и выбор владельца: shadcn/ui на Base UI + [Tailwind CSS 4](https://tailwindcss.com/docs/compatibility).**

- Вид «из коробки» сдержанный и современный, тема — CSS-переменные в одном файле: светлая тема по умолчанию, тёмную просто не подключаем.
- Компоненты лежат в репозитории: панель на карте, тост, меню правятся как свой код, без борьбы с чужими стилями. Минус тот же: обновления компонентов — руками через CLI.
- Base UI без стилей и без своих `z-index`, слои над картой задаём сами (`isolation: isolate` у контейнера карты). У Mantine модалка 200 и поповер 300 — их надо поднимать над контролами карты.
- Tailwind 4 требует Chrome 111, Safari 16.4, Firefox 128 — это и есть «последние браузеры». Preflight лежит в `@layer base`, а стили MapLibre не в слое и его перебивают ([MDN `@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)); на живой карте проверено в change 1: геометрию контролов Preflight не меняет, нужен `isolation: isolate` у карты ([add-web-skeleton](../changes/archive/2026-10-08-add-web-skeleton/design.md#проверки)).

**Mantine 9** — запасной вариант без Tailwind: самый полный набор для панелей настроек (Slider, SegmentedControl, NumberInput, уведомления), светлая тема — `forceColorScheme="light"`, требует React 19.2+. Владелец его не выбрал.

## 3. Карта

### Растр и вектор простыми словами

- **Растровая карта** — мозаика готовых картинок. Сервер где-то заранее нарисовал каждый квадратик на каждом масштабе, браузер их только раскладывает. Вид карты целиком решает тот, кто рисовал: поменять цвет леса или выделить тропы нельзя. Так устроены все слои клона сейчас: OSM, OpenTopoMap, спутник, топокарты. Leaflet умеет только это.
- **Векторная карта** — данные вместо картинок: «здесь лес такой формы», «здесь тропа». Браузер рисует их сам по стилю — файлу, где написано, каким цветом лес и какой толщины тропа. Стиль свой, значит, карта выглядит так, как мы решили: тропы яркие, леса зелёные, подписи вершин по-русски, рельеф тенью. Вращение и плавный зум без размытия. Рисует это видеокарта (WebGL), поэтому нужна библиотека вроде MapLibre.
- **MapLibre умеет и то, и другое**: все растровые слои клона остаются, плюс появляется возможность своей красивой подложки и отмывки рельефа поверх любого слоя.

Пример из backlog — [MapMagic](https://mapmagic.app). Проверено по их сетевым запросам 2026-10-08: в бандле React, Leaflet и MapLibre 6.11.2; плоская карта — Leaflet с их **собственным растром** `tile.mapmagic.app` (512 px), MapLibre включается только в 2.5D/3D с рельефом. То есть их красота — своя картография, нарисованная на их сервере. Нам свой рендер-сервер не по бюджету; тот же результат без сервера даёт векторный стиль, который рисует браузер.

### Библиотеки

| | Leaflet | MapLibre GL JS | OpenLayers |
|---|---|---|---|
| Версия | 1.9.4 (2023-05-18); [2.0 только alpha.1](https://github.com/Leaflet/Leaflet/releases/tag/v2.0.0-alpha.1) (2025-08-16), больше года без релизов | [6.13.0](https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.13.0) (2026-10-06), v6 с 2026-07-22: только ESM, WebGL2 | [10.11.0](https://github.com/openlayers/openlayers/releases/tag/v10.11.0) (2026-10-04) |
| Размер gzip | ≈ 42 КБ | ≈ 285 КБ + воркер ≈ 144 КБ | полный `ol.js` ≈ 298 КБ |
| Растр | да, любые проекции (Яндекс сейчас в EPSG:3395) | только Web Mercator | да, проекции |
| Вектор, отмывка, 3D | нет | да: `raster-dem` с `terrarium`/`mapbox`, [`hillshade-method`](https://maplibre.org/maplibre-style-spec/layers/), `color-relief`, рельеф, глобус | вектор да, отмывка и 3D слабее |
| React | `react-leaflet` 5 только под Leaflet 1.9, лицензия Hippocratic-2.1, последний коммит 2025-06 | `@vis.gl/react-maplibre` 8.1.3 | своих обёрток мало |

**Рекомендация: MapLibre GL JS 6 + `@vis.gl/react-maplibre`.** Leaflet 1.9 выпущен три года назад, 2.0 застрял, а обёртка под React — с нестандартной лицензией. OpenLayers силён в ГИС-проекциях, но для красивой подложки и экосистемы стилей хуже. Цена MapLibre — ≈ 430 КБ gzip против 42 КБ (весь нынешний клиент ≈ 353 КБ gzip JS, замер `nakarte-routing.pages.dev` 2026-10-08) и обязательный WebGL2. Для «только последних браузеров» это приемлемо. Риск — память на телефоне: вкладка уже держит 0.6–0.8 ГБ CheerpJ, плюс видеопамять карты; замер в эмуляции — +110–210 МБ RSS против +15–65 МБ у Leaflet ([add-web-skeleton](../changes/archive/2026-10-08-add-web-skeleton/design.md#память-на-мобильной-эмуляции)), на живом телефоне — с движком в change 2.

### Что будет со слоями из `src/layers.js`

34 кода слоёв ([layers.js](../../src/layers.js)). WebGL берёт растр только с CORS. Проверено `curl` с `Origin: https://nakarte-routing.pages.dev` 2026-10-08:

- Отдают `Access-Control-Allow-Origin`: OSM, CyclOSM, ESRI, Яндекс (карта и спутник), Google (карта, спутник, рельеф), Bing (тайлы `t.ssl.ak.tiles.virtualearth.net`), Slazav (`Q`), OpenTopoMap, Thunderforest, OSM GPS traces, Kartverket, Norway roads, Finland (отражает `Origin`), Waymarked Trails, Slovakia (`St`), IGN, swisstopo, Lantmäteriet (отражает `Origin`), покрытие Street View. Флаг `noCors` у `Q`, `Z` и `St` устарел: сейчас они CORS отдают.
- Через прокси (у него свой CORS): Strava, Tsvetkov (`Mt`), swisstopo, Wikimapia. Прямой тайл Strava отвечает `403`.
- Токены URL MapLibre: `{quadkey}` (Bing), `{ratio}` (`@2x`), `{prefix}` есть ([tile_id.ts](https://github.com/maplibre/maplibre-gl-js/blob/v6.13.0/src/tile/tile_id.ts)); поддомены `{s}` — массивом адресов. Google сейчас считает `zoom = 17 − z` — через `transformRequest` или адрес с `z=`.
- **Яндекс (`Y`, `S`)** — EPSG:3395, MapLibre его [не поддерживает](https://github.com/maplibre/maplibre-gl-js/discussions/6400). Вариант — перепроекция в браузере через [`addProtocol`](https://maplibre.org/maplibre-gl-js/docs/API/functions/addProtocol/): склеить два тайла Яндекса со сдвигом по вертикали, как сейчас делает `_adjustHeight` ([leaflet.layer.yandex](../../src/lib/leaflet.layer.yandex/index.js)). Около дня. Решение владельца: в первой версии Яндекса нет, вернуть — пункт backlog.
- **Обрезка по контуру** (`TileLayer.cutline` у `Mt`, `Nr`, `Fmk`, `Gbt`, `St`, `Sp`, `Si`) — в MapLibre есть только прямоугольник `bounds` у источника. Предлагаю `bounds` и без обрезки по полигону.
- **Wikimapia (`W`)** и **сетка советских топокарт (`Ng`)** — свои слои на canvas, не тайлы: сетка — GeoJSON, полдня; Wikimapia — свой загрузчик через прокси, около дня. Решение владельца: убираются.
- Свои слои пользователя (диалог «Add custom layer» в [layers.configure](../../src/lib/leaflet.control.layers.configure/index.js)) — растр по URL; без CORS не покажутся. Решение: проверять CORS при добавлении и предлагать прокси.

### Подложка по умолчанию: векторная, туристическая

Готового туристического векторного стиля с `sac_scale` и маршрутами-отношениями в открытых схемах нет; это есть только в закрытой [MapTiler Outdoor](https://docs.maptiler.com/schema/outdoor/) (бесплатно 5 тыс. сессий в месяц, только некоммерческое, при превышении [сервис встаёт](https://www.maptiler.com/cloud/pricing/)). Что есть в открытых:

| Источник | Схема | Для походов | Цена | Риск |
|---|---|---|---|---|
| [OpenFreeMap](https://openfreemap.org/) | OpenMapTiles, до z14 | `path`/`track`, `surface`, `mtb_scale`; вершины, седловины, `ele`; `name:ru` | $0, без ключа и лимитов | донаты, без SLA |
| [Protomaps](https://docs.protomaps.com/basemaps/layers), свой хостинг в R2 | Protomaps, до z15 | `kind=path`, вершины с высотой, хижины; седловин и SAC нет; `name:ru` | планета 138.7 ГБ ([builds.json](https://build-metadata.protomaps.dev/builds.json)) ≈ **+$2.08 в месяц** по [прайсу R2](https://developers.cloudflare.com/r2/pricing/) | свой хостинг, обновлять — перекачивать 139 ГБ |
| VersaTiles | Shortbread | тропы есть, вершин и `name:ru` нет | $0 | — |
| MapTiler, Stadia, Thunderforest | свои | есть | бесплатные тарифы некоммерческие или с потолком | условия |

Отмывка рельефа (тени гор — главное, что делает карту «туристической»):

| Источник DEM | Разрешение | Цена | CORS (проверено) | Риск |
|---|---|---|---|---|
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), Terrarium | до z15 | $0, AWS Open Data | `*` | атрибуция по [списку](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) |
| [Mapterhorn](https://mapterhorn.com/data-access), Terrarium WebP 512 px | z12 планета, z13–17 регионами | $0 | `*` | условия хостинга не опубликованы |
| Наши тайлы высот ([elevation-tiles](../specs/elevation-tiles/spec.md)) | z11, 3″ | $0 сверху, но формат не картинка: перекодировать в Terrarium (`addProtocol` или новый путь Worker'а) | свой | мыльно на крупных масштабах; z10–11 считаются на лету без бюджета чтений R2 (P2 в backlog) |

Сейчас подложка по умолчанию — первый слой списка, растровый OpenStreetMap `tile.openstreetmap.org` (выбор первого базового слоя — [layers.configure](../../src/lib/leaflet.control.layers.configure/index.js)); на момент переключения она такой и останется (решение владельца).

Туристический слой самого openstreetmap.org — **Tracestrack Topo** ([список слоёв сайта](https://github.com/openstreetmap/openstreetmap-website/blob/master/config/layers.yml)): растр с рельефом и тропами, только по ключу; у сайта OSM ключ свой. Условия на [tracestrack.com](https://tracestrack.com/) (2026-10-08): бесплатный тариф Intro — 100 тыс. кредитов в месяц, растровый тайл — 1 кредит, только некоммерческое использование; что при превышении, не сказано; Personal — €3.99 в месяц, 250 тыс. кредитов, тоже некоммерческий; подпись «Maps © Tracestrack» обязательна ([условия](https://www.tracestrack.com/en/terms)). Заход на карту — порядка 50–150 тайлов (оценка), то есть 700–2000 заходов в месяц. Предложение: Tracestrack Topo по умолчанию, ключ в секрете прокси (иначе квоту выберут с чужих сайтов), откат на OSM при ошибке; ключ заводит владелец. Ответа нет — [открытый вопрос](#вопросы-владельцу).

**Рекомендация на потом.** Свой стиль «outdoor» на тайлах OpenFreeMap (схема OpenMapTiles): лес и растительность цветом, тропы ярче дорог, подписи `name:ru` с откатом на `name`, вершины и перевалы с высотой; отмывка — AWS Terrain Tiles (решение владельца — попробовать), `hillshade-method: multidirectional`. Шрифты с кириллицей — Noto PBF [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets) (OFL) статикой Pages. Итог $0. Если OpenFreeMap закроется — та же схема OpenMapTiles генерируется [Planetiler](https://github.com/onthegomap/planetiler) в PMTiles на свой R2; ресурсы для планеты по README Planetiler — память ≈ половины `.osm.pbf` и несколько часов, размер результата не подтверждён. Отдельным, но не первым шагом. Разметка троп по SAC — только свой профиль Planetiler на Java (недели).

Раздавать свои PMTiles, если до них дойдёт, — Pages Function на `nakarte-routing.pages.dev`, как `functions/tiles`: Cache API на `*.workers.dev` [не работает](https://developers.cloudflare.com/r2/examples/cache-api/), а у Pages Functions [доступен](https://developers.cloudflare.com/workers/runtime-apis/cache/) (на живом `*.pages.dev` не проверено).

### Редактор маршрута поверх карты

Готовые пакеты рисования — [terra-draw](https://github.com/JamesLMilner/terra-draw) 1.37 (MIT, адаптер MapLibre заявлен для v4/v5, с v6 не подтверждён), `@geoman-io/maplibre-geoman-free` 0.10 (MIT, MapLibre 6) — рисуют фигуры, а не маршрут из опорных точек и отрезков с активностью, ожиданием и устаревшими ответами ([route-editing](../specs/route-editing/spec.md)). Рекомендация: своя модель редактора — чистый TypeScript без карты (узлы, `leg`, очередь, undo/redo; покрывается unit-тестами по сценариям спеки), отрисовка — GeoJSON-источник для линии и непроложенных отрезков плюс слой точек для опорных; перетаскивание — события карты. Подвохи нынешнего редактора (`_drawingDirection`, временный узел под курсором, `keydown` для хоткеев на macOS) — `AGENTS.md`, [«Где код роутинга»](../../AGENTS.md#где-код-роутинга): первые два — следствия модели Leaflet и уходят, третий остаётся.

## 4. Движок прокладки

### CheerpJ в новом приложении

Ограничения из спеки [browser-routing-engine](../specs/browser-routing-engine/spec.md) и `AGENTS.md` ([«Движок в браузере»](../../AGENTS.md#движок-в-браузере-cheerpj)) от UI не зависят и переносятся как есть:

- **Один library-поток на страницу** → движок — синглтон вне React (модуль `engine.ts`), очередь запросов внутри; компоненты получают только промисы. Не создавать движок в эффекте компонента: Strict Mode в dev вызывает эффекты дважды.
- **`/app/` только с origin страницы, Range с `206`** → `/tiles/` и `/brouter-wasm/` остаются Pages Functions того же проекта ([clone-hosting](../specs/clone-hosting/spec.md), «Тайлы BRouter на том же origin», «Range для файлов движка»). `/app/` CheerpJ — корень origin, поэтому приложение на `/next/` тоже работает (проверено в change 2 на проде).
- **Холодный старт 5–6 с, первый маршрут до 10+ с** → прогрев при выборе активности (уже требование), в UI — явное состояние «движок загружается» на кнопке активности вместо молчаливого ожидания.
- **0.6–0.8 ГБ на вкладку** (по RSS; в change 2 движок в воркере — ≈ 0.3–0.5 ГБ `phys_footprint`) → не грузить движок, пока прокладка выключена (уже требование).
- **Блокировка главного потока.** Новое: CheerpJ с [3.0rc2](https://cheerpj.com/docs/changelog.html) (2023-11-29) поддерживает Web Worker через `importScripts`; сейчас последняя версия — 4.3 (2026-04-21). Движок в Worker'е не подвешивает карту на время маршрута. Проверено в change 2 ([архив](../changes/archive/2026-10-08-spike-engine-in-worker/design.md)): работает, главный поток свободен, library-поток — один на воркер.
- **Рантайм с CDN Leaning Technologies** и лицензия Community — без изменений ([backlog](../backlog.md), «Отложено»).

### Серверный BRouter на VPS

Что нужно ([vps-источники ниже](#источники-цены-vps)):

- Данные: мир на [brouter.de/brouter/segments4](https://brouter.de/brouter/segments4/) — 1 142 файла `*.rd5`, 10.02 ГБ (2026-10-08).
- Память: официальный [`server.sh`](https://github.com/abrensch/brouter/blob/master/misc/scripts/standalone/server.sh) запускает JVM с `-Xmx128M` и одним потоком; `*.rd5` читаются кусками через `RandomAccessFile`, не целиком. Автор BRouter: больше `-Xmx` вредно, важен файловый кеш ОС и SSD ([issue #150](https://github.com/abrensch/brouter/issues/150)). Официальной рекомендации по RAM нет; оценка — 2–4 ГБ RAM, NVMe, диск от 30–40 ГБ (данные + место под замену).

| Вариант | Конфигурация | Цена в месяц, без НДС | Против порога (+$5 к ≈ $5.25) |
|---|---|---|---|
| OVH VPS-1 | 2 vCore, 4 ГБ, 40 ГБ NVMe, IPv4 и трафик включены | €4.49 помесячно, €3.81 при оплате за год ([каталог OVH](https://eu.api.ovh.com/1.0/order/catalog/public/vps?ovhSubsidiary=IE)) ≈ $4.4–5.2 | почти удвоение — **не проходит** |
| Contabo Cloud VPS 4 | 4 vCPU, 8 ГБ, 100 ГБ SSD | €4.40 при контракте на 24 месяца ([contabo.com](https://contabo.com/en/vps/)) | не проходит |
| Hetzner CX23 | 2 vCPU, 4 ГБ, 40 ГБ | €5.49 / $6.49 с 2026-06-15 + IPv4 €0.50 ([прайс](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)); линейка сейчас «currently unavailable» | не проходит |
| DigitalOcean, Vultr, Fly.io | 2 ГБ | $10–12 | не проходит |
| Cloudflare Containers | диск эфемерный, до 20 ГБ ([FAQ](https://developers.cloudflare.com/containers/faq/)) | always-on ≈ $39 | не годится |
| Oracle Always Free A1 | 2 OCPU, 12 ГБ, до 200 ГБ | $0 | проходит, но простаивающий инстанс Oracle [может забрать](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) (CPU, сеть и память ниже 20% за 7 дней — наш случай), при создании бывает «out of host capacity» |
| API brouter.de напрямую | — | $0 | CORS открыт, но условий для сторонних приложений нет, сервер один, «one session kills the other» ([online.html](https://brouter.de/brouter/online.html)) — без согласия автора нельзя |

**Рекомендация.** Движок остаётся в браузере. Платный VPS (+$4.4–7) порог не проходит, Oracle Free проходит по деньгам, но добавляет администрирование и риск, что сервер заберут; с CheerpJ его выигрыш — скорость (сервер в 3–4 раза быстрее) и память вкладки. Вернуться к VPS, если CheerpJ упрётся в лицензию или CDN; Oracle Always Free владелец хочет попробовать отдельно — пункт backlog. Спайк Web Worker — главное улучшение движка для нового UI.

#### Источники цены VPS

Hetzner: [price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [IPv4](https://docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing/), [cost-optimized](https://www.hetzner.com/cloud/cost-optimized/). OVH: [VPS](https://www.ovhcloud.com/en-ie/vps/), [каталог API](https://eu.api.ovh.com/1.0/order/catalog/public/vps?ovhSubsidiary=IE) (план `vps-2027-model1`). Contabo: [VPS](https://contabo.com/en/vps/). DigitalOcean: [droplets](https://www.digitalocean.com/pricing/droplets). Fly.io: [pricing](https://docs.fly.io/about/pricing). Cloudflare Containers: [pricing](https://developers.cloudflare.com/containers/pricing/), [limits](https://developers.cloudflare.com/containers/platform-details/limits/). Oracle: [Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). Курс евро к доллару не сверялся; USD-страница OVH пишет «From $4.54».

## 5. Инвентаризация функций

По [App.js](../../src/App.js), [track-list.js](../../src/lib/leaflet.control.track-list/track-list.js) и модулям `src/lib/`. Клиент — ≈ 19.6 тыс. строк JS без `vendored/`, `knockout` в 11 файлах.

| Функция | Где сейчас | Решение |
|---|---|---|
| Слои: выбор, группы, хоткеи, настройка списка, свои слои по URL, `l=` | `layers.js`, `leaflet.control.layers.*` | переносим без Яндекса, Wikimapia, сетки `Ng` ([п. 3](#что-будет-со-слоями-из-srclayersjs)) и хоткеев слоёв (решение владельца, [add-web-map-layers](../changes/add-web-map-layers/design.md#переключатель-владелец)) |
| Список треков: новый трек, видимость, цвет, длина, отметки расстояния, переименовать, дублировать, развернуть, удалить, удалить все/скрытые, новый трек из видимых | `track-list` | переносим |
| Правка линии: сегменты, точки, Cut, Join, Shortcut, удалить сегмент, новый трек из сегмента | `track-list`, `polyline-edit` | переносим |
| Точки: переименовать, переместить, скопировать координаты, удалить | `track-list` | переносим |
| Прокладка, активности, редактор, undo/redo | `brouter`, `polyline-edit` | переносим; непроложенный отрезок + тост (решение владельца); кнопки undo/redo — backlog «Редактор и активности» |
| Импорт файлов: GPX, KML, KMZ, GeoJSON, Ozi (`plt`, `rte`, `wpt`), ZIP | `parsers/` | переносим, парсеры — чистые модули, тесты на фикстурах |
| Импорт по ссылкам: Yandex, OSM, SportsTracker, Tracedetrail, ссылки nakarte | `services/` | переносим |
| Импорт Strava, Garmin Connect, Wikiloc | `services/` | не работают (backlog, «Отложено») — **убираются** (решение владельца) |
| Экспорт GPX, KML, ZIP, GPX с высотами | `geo_file_exporters.js` | переносим |
| Ссылка на треки (`nktl=`, «Copy link for track/all/visible») | `track-list`, `services/nakarte` | переносим; ссылка отдаётся после ответа хранилища, а не до ([аудит, п. 2](system-design-audit.md#2-контракты)) |
| Профиль высот | `leaflet.control.elevation-profile`, `elevations` | переносим |
| Линейка («Measure distance» — трек «Ruler» с отметками) | `control-ruler.js` | переносим как инструмент трека (решение владельца) |
| Поиск: photon, mapy.cz, координаты, ссылки на карты; метка `r=` | `leaflet.control.search`, `leaflet.placemark` | переносим |
| Street View | `leaflet.control.panoramas` | переносим: панорама — в своём `div` через Maps JS API, покрытие — растр с CORS |
| Внешние карты (Google, Yandex, OSM, Google Earth, Mapy.cz, Wikimapia, Meteoblue) | `leaflet.control.external-maps` | переносим |
| Геолокация, масштаб, индикатор зума | `locate`, `zoom-display` | переносим |
| Встраивание в iframe: `min=`, `autoprofile`, без сессий в iframe | `App.js` | **не переносим** (решение владельца), параметры игнорируются |
| Журнал событий и Sentry | `logging` | не переносим: `eventsLogUrl` и `sentryDSN` пустые; ошибки клиента — отдельный P2 аудита |
| Экспорт JNX, печать в PDF, контрол координат с высотой, «Recent sessions», «Copy share link», азимут | — | **удаляются** (решение владельца) |

### Последствия удаления

- **Тайлы высот.** Единственный потребитель в коде — контрол координат (`elevationTileUrl` читает только [App.js](../../src/App.js) → `leaflet.control.coordinates`). Отмывку новой карты дешевле брать из AWS Terrain Tiles ([п. 3](#подложка-по-умолчанию-векторная-туристическая)). Решение владельца: так и делаем — тайлы высот выводятся из эксплуатации в change переключения: маршрут `/tiles/` Worker'а высот, архив `tiles/elevation-z0-9` (≈ 3.8 ГБ, ≈ $0.06 в месяц), спека [elevation-tiles](../specs/elevation-tiles/spec.md), требование «Свои тайлы высот» в [clone-hosting](../specs/clone-hosting/spec.md); заодно закрывается P2 backlog «Тайлы высот z10–11 без бюджета чтений R2». API высот остаётся (профиль, GPX с высотами).
- **Сессии.** Код показывает больше, чем записано в архиве: сессия хранит не только разметку маршрута, а **сами треки вкладки** между перезагрузками (`loadSession` → `loadTracksFromString` + `applyRouteMarkup` в [leaflet.control.sessions](../../src/lib/leaflet.control.sessions/index.js), IndexedDB `sessions`). Без сессий треки исчезают при перезагрузке. Решение владельца: убрать список сессий, `sid=`, `BroadcastChannel` и переключение вкладок; оставить автосохранение рабочего набора (треки + разметка) в IndexedDB. Подхватывать ли при переключении последнюю сессию старого клиента — решается в change переключения.
- **Прокси для `noCors`.** Через прокси шли растеризация печати и JNX (`leaflet.layer.rasterize`) и обрезка по контуру; с удалением печати и JNX растеризация уходит. Для показа в MapLibre CORS нужен всем растровым слоям — проверка выше: прямые хосты его отдают, через прокси идут Strava, Tsvetkov, swisstopo, Wikimapia, импорт по ссылкам, поиск mapy.cz и страница Bing для слоя Ordnance Survey. Роли прокси не расширяются.

## 6. Контракты, которые новый UI держит

Полная таблица — [аудит, п. 2](system-design-audit.md#2-контракты). Для нового приложения из неё следует:

- **Адрес.** Приложение живёт на `nakarte-routing.pages.dev`: на нём старые ссылки `nktl=`. Свой домен и редирект — с переименованием (backlog, «Новое название проекта»).
- **Файлы движка с того же origin.** `/tiles/*.rd5`, `/tiles/storageconfig.txt` и `/brouter-wasm/*` отдают [functions/](../../functions/) с `206`; Vite кладёт сборку в тот же `build/`, а `experiments/wasm/cheerpj/build.sh` — файлы движка в `build/brouter-wasm/` до деплоя ([clone-deploy](../specs/clone-deploy/spec.md), «Сборка без файлов движка не выкатывается»). Функции и их `_middleware.js` со счётчиком `GUARD` ([worker-limits](../specs/worker-limits/spec.md), «Частота запросов к Pages Functions») от клиента не зависят и не меняются.
- **Сервисы Worker'ов.** Адреса — одно место конфигурации, как сейчас [src/config.js](../../src/config.js) + `config-target` ([client.md](../../docs/architecture/client.md#как-собираются-адреса-сервисов)). В Vite это `web/src/config.ts` с режимами сборки (`vite build --mode clone`) и переменными `VITE_*`; ключ Google — `VITE_GOOGLE_MAPS_API_KEY` из секрета вместо `sed` в `deploy-pages.yml`. Клиент на первом этапе ходит в существующие контракты; `v2` (без `credentials`, формат высот) — по сервису, когда понадобится ([аудит, «Переделки»](system-design-audit.md#переделки)).
- **Старые ссылки.** Читаются: `m=`, `l=` (включая коды удалённых слоёв — требование «Старые коды удалённых слоёв» в [clone-hosting](../specs/clone-hosting/spec.md); то же для `leafletLayersSettings` в `localStorage`), `nktk=` версий 1–4 ([nktk.js](../../src/lib/leaflet.control.track-list/lib/parsers/nktk.js)), `nktl=`, `nktu=`, `nktp=`, `nktj=`, `r=`, `n2=` и `n=` (панорамы). «Copy link» копировал весь `#` кроме `q` и `r` (`keysToExcludeOnCopyLink` в [App.js](../../src/App.js)), поэтому в старых ссылках бывают `p=` (печать), `j=` (JNX), `min=`, `sid=` — их новый UI молча игнорирует. Разбор адреса — первый модуль с тестами на набор реальных старых ссылок.
- **Новые ссылки** несут разметку маршрута (новая версия `nktk` или параметр — решение владельца в архиве); формат выбирается в change автосохранения и ссылок, разбор `nktk` 1–4 остаётся навсегда.

## 7. План перехода

**Постепенно, но не вперемешку.** Переписывать по кусочку внутри старого клиента нельзя: knockout и Leaflet-контролы не смешать с React без моста, который потом выбрасывать. Большой взрыв одним PR тоже плох: недели без деплоя и без проверки на проде. Поэтому новое приложение растёт рядом и выкатывается на прод с первого change, но по другому пути.

- **Где живёт.** `web/` в корне монорепо — по образцу `workers/<сервис>/`: свои `package.json`, lock-файл, `.npmrc`, `biome.json`, `tsconfig.json`, `vite.config.ts`. Название не `app/`, чтобы не путать с `/app/` CheerpJ.
- **Где выкатывается.** В тот же Pages-проект `nakarte-routing`, в `build/next/` (`base: '/next/'`), то есть `https://nakarte-routing.pages.dev/next/`. Тот же origin — значит, `/tiles/`, `/brouter-wasm/`, guard и CORS Worker'ов работают без изменений, нового проекта и прав токена не нужно. Отдельный Pages-проект дал бы чистый URL, но потребовал бы своих функций, привязок R2 и `GUARD` и правки `ALLOWED_ORIGINS` всех Worker'ов. `localStorage` и IndexedDB общие на origin — новое приложение берёт свои имена ключей и баз.
- **Деплой.** Job `pages` в [deploy-pages.yml](../../.github/workflows/deploy-pages.yml) собирает старый клиент в `build/`, новый — в `build/next/`; фильтр путей job'а `changes` дополняется `web/**`. Тесты нового приложения — шаг перед сборкой ([clone-deploy](../specs/clone-deploy/spec.md), «Тесты сервиса перед его деплоем»).
- **Старый клиент.** Заморожен: только поломки. В change переключения новое приложение встаёт на `/`, удаляются `src/`, `test/` и karma, `webpack/`, корневые зависимости клиента, `main.yml` (апстримный `check`) и его правило «не трогаем» в `AGENTS.md`; линт `workers/` и `functions/` переезжает в Biome. Правило задач в [openspec/config.yaml](../config.yaml) («karma для клиента») меняется в первом change.
- **Спеки.** Спеки — контракт поведения, а не реализации. Каждый change нового приложения правит свои требования дельтами (`MODIFIED`): тексты UI («Off: straight lines», «Routing failed: …»), меню и кнопки — по новому дизайну, модель (опорные точки, отрезки, очередь, устаревшие ответы) — как есть. Требования, которые описывают устройство старого клиента (`NAKARTE_TARGET`, karma, `leafletLayersSettings`), меняются в change переключения. Пока старый клиент жив, спека описывает его, а новое поведение лежит в дельтах change'ей — `openspec validate` это допускает.
- **Документация.** `docs/architecture/client.md` и `route-editor.md` переписываются в change переключения; до него новый клиент описан в `design.md` своих changes.

## Итог

| Решение | Варианты | Рекомендация | Почему | Цена |
|---|---|---|---|---|
| Фреймворк и сборка | React + Vite; Svelte; Solid; Preact | React 19.3 + Vite 8 | зрелые обёртки MapLibre, пожелание владельца | — |
| Язык | JS; TS 6; TS 7 | TypeScript 7, strict | быстрый `tsc`, API не нужен | — |
| Линт и формат | Biome; oxlint + oxfmt; ESLint + Prettier | Biome 2.5 | стабилен, один инструмент; Oxc — когда oxfmt 1.0 | час на переезд, если решим |
| Состояние и адрес | Zustand; Jotai; TanStack Router; nuqs | Zustand + свой `hash.ts` | одна страница, свой формат адреса | — |
| Тесты | karma; Vitest; Playwright | Vitest (unit + browser mode) + Playwright e2e | один раннер, Chromium из Playwright | — |
| CI | `main.yml`; свой workflow | `check-web.yml` с `paths: web/**`; `main.yml` удаляется со старым клиентом | правило монорепо | — |
| UI-библиотека | shadcn/ui; Mantine; React Aria; HeroUI; MUI; antd | shadcn/ui на Base UI + Tailwind 4 — решение владельца | красиво из коробки, лёгкий, свой код, без `z-index`-войн | — |
| Карта | Leaflet 1.9; MapLibre 6; OpenLayers | MapLibre GL JS 6 + `@vis.gl/react-maplibre` | вектор, отмывка, растр сохраняется; Leaflet 2 застрял | +≈ 430 КБ gzip, WebGL2 |
| Подложка | растр OSM; Tracestrack Topo; OpenFreeMap + свой стиль; Protomaps в R2; MapTiler Outdoor | при переключении — растр OSM (решение владельца); дальше — не решено: Tracestrack Topo или свой стиль на OpenFreeMap | Tracestrack — готовый туристический слой с сайта OSM; свой стиль — без квот | Tracestrack $0 до 100 тыс. тайлов в месяц; свой стиль $0 |
| Отмывка | AWS Terrain Tiles; Mapterhorn; свои тайлы высот | AWS Terrain Tiles — владелец: попробовать | $0, открытые данные, до z15 | $0 |
| Яндекс | перепроекция; убрать | нет в первой версии, пункт backlog — решение владельца | MapLibre только Web Mercator | ≈ день, когда вернём |
| Движок | CheerpJ; VPS; Oracle Free; brouter.de | CheerpJ + спайк Web Worker; Oracle Free — backlog | VPS +$4.4–7 не проходит порог | спайк полдня–день |
| Тайлы высот | оставить; отмывка из них; вывести | вывести при переключении — решение владельца | единственный клиент удаляется | −≈ $0.06/мес, минус P2-риск |
| Сессии | убрать всё; автосохранение без списка | автосохранение без списка — решение владельца | без него треки пропадают при перезагрузке | входит в change автосохранения |
| Переход | большой взрыв; по кусочку в старом; рядом на `/next/` | `web/` на `/next/`, после changes 1–8 — на `/` (решение владельца) | прод с первого change, тот же origin | change переключения 1–2 дня |

## Changes по порядку

Цена — дни работы агента с тестами и CI. Номера 3–8 можно частично параллелить после 1.

| № | Change | Что | Цена |
|---|---|---|---|
| 1 | [`add-web-skeleton`](../changes/archive/2026-10-08-add-web-skeleton/design.md) — сделан | `web/` с Vite, React, TS, Biome, Vitest, Playwright, shadcn; `check-web.yml`; сборка в `build/next/` и деплой; конфиг сервисов; пустая карта MapLibre с OSM; проверка Preflight против стилей карты, памяти на телефоне и `/app/` CheerpJ с `/next/` | 1–2 |
| 2 | [`spike-engine-in-worker`](../changes/archive/2026-10-08-spike-engine-in-worker/design.md) — сделан | CheerpJ в Web Worker в новом приложении: `cheerpjRunLibrary`, `/app/`, один поток, замер блокировки главного потока; модуль `engine.ts` с очередью | 0.5–1 |
| 3 | `add-web-map-layers` | каталог растровых слоёв с кодами без `Y`, `S`, `W`, `Ng`; `l=` и старые коды; переключатель слоёв, свои слои по URL; отмывка AWS Terrain Tiles как слой | 2–3 |
| 4 | `add-web-tracks` | парсеры и экспорт как чистые модули с тестами, чтение старых ссылок (`nktk` 1–4, `nktl`, `nktu`, `nktp`, `nktj`), список треков, ссылка на треки после ответа хранилища | 3–4 |
| 5 | `add-web-route-editor` | модель редактора на TS, отрисовка на карте, активности, непроложенный отрезок + тост, undo/redo с кнопками; спеки `routing` и `route-editing` дельтами | 5–7 |
| 6 | `add-web-autosave` | автосохранение треков и разметки в IndexedDB, разметка маршрута в ссылке (новая версия `nktk`) | 1–2 |
| 7 | `add-web-elevation-profile` | профиль высот, GPX с высотами | 1–2 |
| 8 | `add-web-search-panoramas` | поиск, метка `r=`, Street View, внешние карты, геолокация, линейка | 2–3 |
| 9 | `switch-to-web-app` | новое приложение на `/` с OSM по умолчанию, удаление старого клиента, karma, webpack, `main.yml`; спеки и `docs/architecture`; вывод тайлов высот | 1–2 |
| 10 | `add-outdoor-basemap` | туристическая подложка по умолчанию: Tracestrack Topo через прокси или свой стиль на OpenFreeMap (по ответу владельца); закрывает пункт backlog про слой как у MapMagic | 1–5 |
| 11 | `polish-web-ui` | полировка интерфейса после всех фронтовых changes (просьба владельца 2026-10-08): агент собирает промпт для Claude Design — экраны, компоненты shadcn, тема, ограничения (только светлая тема, телефон 390×844, карта под панелями) и скриншоты текущего вида; по ответу — правки вёрстки | 1–2 |

Итого ≈ 18–31 день. Контракты `v2` Worker'ов (аудит, P2) — отдельно, по сервису, 1–2 дня каждый, когда понадобятся.

## Вопросы владельцу

Ответы 2026-10-08 — архив [record-new-ui-decisions](../changes/archive/2026-10-08-record-new-ui-decisions/design.md). Открыт один:

- **Слой по умолчанию после переключения.** Tracestrack Topo (туристический слой openstreetmap.org, бесплатно до 100 тыс. тайлов в месяц, только некоммерческое использование, ключ заводит владелец) или свой стиль на OpenFreeMap ($0 без квот, 3–5 дней работы)? Факты — [подложка по умолчанию](#подложка-по-умолчанию-векторная-туристическая). Решение нужно к change `add-outdoor-basemap`.
