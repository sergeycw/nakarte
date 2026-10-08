# Design

## Context

Зачем — [proposal](proposal.md). Что переносится и что нет — [ресёрч, п. 3](../../research/new-ui.md#что-будет-со-слоями-из-srclayersjs) и [п. 6](../../research/new-ui.md#6-контракты-которые-новый-ui-держит); решения владельца — архивы [record-ui-decisions](../archive/2026-10-08-record-ui-decisions/design.md) и [record-new-ui-decisions](../archive/2026-10-08-record-new-ui-decisions/design.md); каркас — [add-web-skeleton](../archive/2026-10-08-add-web-skeleton/design.md) (Zustand ставится здесь, зум MapLibre = зум Leaflet − 1).

Справочник старого клиента: каталог [src/layers.js](../../../src/layers.js) (34 кода, группы `groupsDefs`, порядок наложения `titlesByOrder`), Google ([leaflet.layer.google](../../../src/lib/leaflet.layer.google/index.js), `zoom = 17 − z`), Bing ([leaflet.layer.bing](../../../src/lib/leaflet.layer.bing/index.js), адрес из `bing.com/maps/style`), retina ([RetinaTileLayer](../../../src/lib/leaflet.layer.RetinaTileLayer/index.js)), настройка списка, свои слои и `leafletLayersSettings` ([layers.configure](../../../src/lib/leaflet.control.layers.configure/index.js), [customLayer.js](../../../src/lib/leaflet.control.layers.configure/customLayer.js)), адрес ([hashState.js](../../../src/lib/leaflet.hashState/hashState.js), [Leaflet.Map.js](../../../src/lib/leaflet.hashState/Leaflet.Map.js), [Leaflet.Control.Layers.js](../../../src/lib/leaflet.hashState/Leaflet.Control.Layers.js)).

Как старый клиент читает адрес: `#k=v1/v2&k2` — пары через `&`, значения через `/`, ключ без `=` — пустой список. `m=zoom/lat/lng`: целый зум 0–32, широта −90…90, иначе вид по умолчанию. `l=` — коды снизу вверх; если среди них нет ни одной подложки, `l=` игнорируется целиком; неизвестные коды пропускаются; код `-cs<base64>` — свой слой (URL-safe base64 от JSON полей формы), он добавляется в список.

Проверено 2026-10-08 (`curl` с `Origin: https://nakarte-routing.pages.dev`, исходники `maplibre-gl` 6.13.0 в `web/node_modules`):

- **CORS.** `Access-Control-Allow-Origin` отдают OSM, CyclOSM, ESRI, Google (все четыре), тайлы Bing (`t.ssl.ak.tiles.virtualearth.net` и `t.ssl.ak.dynamic.tiles.virtualearth.net`), OpenTopoMap, Thunderforest, OSM GPS traces, Kartverket, finn.no, laji.fi и Lantmäteriet (отражают `Origin`), Waymarked Trails, IGN, swisstopo, AWS Terrain Tiles. Без CORS: Tsvetkov (`maptiles.website.yandexcloud.net`), Strava (прямой тайл — `403`).
- **Редирект без CORS.** `slazav.xyz/tiles/hr/{x}-{y}-{z}.png` и `/podm/` отвечают `302` на `tiles.slazav.xyz/{hr,podm}/{z}/{x}/{y}.png`, `static.mapy.hiking.sk/topo/…` — `307` на `tile.mapy.hiking.sk/otm/…`. У ответов редиректа нет `Access-Control-Allow-Origin`, а для CORS-запроса браузер проверяет каждый ответ цепочки. Конечные адреса CORS отдают (`*`). Ресёрч («флаг `noCors` у `Q`, `Z` и `St` устарел») верен только для конечных адресов.
- **swisstopo** напрямую отдаёт `Access-Control-Allow-Origin: *` и с `Referer` клона. В ресёрче swisstopo стоит и в списке «отдают CORS», и в списке «через прокси» — второе унаследовано от старого клиента (2021).
- **Bing.** Спутник: адрес из `bing.com/maps/style?styleid=aerial` — `…/tiles/a{quadkey}.jpeg?g=15625&n=z&prx=1`; без `g` — `400`, с любым `g` — тот же тайл. Ordnance Survey: тайл из `styleid=ordnancesurvey` отдаётся с CORS и одинаковым содержимым с ключом сессии, с чужим ключом и без него (тайл Грасмира z13 — карта OS). Ключ сессии со страницы `bing.com/maps` через прокси не нужен.
- **Google** с `z={z}` вместо `zoom={17−z}` отдаёт байт в байт те же тайлы (`lyrs=m`, `t,r`, `h`), значит `transformRequest` не нужен.
- **AWS Terrain Tiles.** `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, CORS `*`, z15 есть, z16 — `404`. Реплика `elevation-tiles-prod-eu` публично отвечает `403`. Атрибуция — [joerd/docs/attribution.md](https://github.com/tilezen/joerd/blob/master/docs/attribution.md): список источников DEM (11 пунктов), при хостинге Mapzen — плюс «Mapzen»; где показывать — «reasonable to the medium», со ссылкой на правила OSMF. Лицензия в [реестре AWS Open Data](https://github.com/awslabs/open-data-registry/blob/main/datasets/terrain-tiles.yaml) указывает на тот же файл.
- **MapLibre 6.13.** Адрес тайла — `urls[(x + y) % urls.length]` с токенами `{z}`, `{x}`, `{y}`, `{prefix}`, `{ratio}` (`@2x` при `pixelRatio > 1`), `{quadkey}`, `{bbox-epsg-3857}`, `scheme: 'tms'` переворачивает `y` ([tile_id.ts](https://github.com/maplibre/maplibre-gl-js/blob/v6.13.0/src/tile/tile_id.ts)). Зум тайлов — `floor(zoom + log2(512 / tileSize))` ([covering_tiles.ts](https://github.com/maplibre/maplibre-gl-js/blob/v6.13.0/src/geo/projection/covering_tiles.ts)): `tileSize: 128` даёт +2, то есть повторяет `tileSize: 128, zoomOffset: 1` Leaflet у swisstopo. `bounds` источника ([tile_bounds.ts](https://github.com/maplibre/maplibre-gl-js/blob/v6.13.0/src/tile/tile_bounds.ts)) отсекает тайлы вне прямоугольника. `hillshade-method: multidirectional` есть в типах 6.13 (`maplibre-gl.d.ts`).

## Goals / Non-Goals

**Goals:**
- Модули, на которые следующие changes опираются без переделки: `hash.ts` (треки добавят `nktk`, `nktl` и др.), стор Zustand, стиль карты из выбранных слоёв.
- Тесты, которые ловят любой запрос тайла мимо подмены, — чтобы новые слои не тянули сеть в CI.

**Non-Goals:**
- Яндекс, Wikimapia, сетка `Ng` (решения владельца), Street View и его покрытие (change 8), туристическая подложка по умолчанию (change 10).
- Обзор покрытия на мелком масштабе (`LayerCutlineOverview` у `Mt`, `Gbt`, `St`) и обрезка по полигону — только `bounds`, как предлагал ресёрч.
- Изменения старого клиента, CORS-прокси и его `ALLOWED_ORIGINS`.

## Decisions

Решения, которых нет в ресёрче, архивах и задаче change, помечены **[владелец]**; владелец подтвердил их 2026-10-08, включая запоминание последнего выбора слоёв.

### Каталог — данные на TS, собираются функцией от среды

`web/src/layers/catalog.ts`: `buildCatalog({pixelRatio, language, corsProxyUrl})` возвращает список `LayerDef` (код, название, группа, порядок наложения, подложка или оверлей, «в списке по умолчанию», источник MapLibre: `tiles[]`, `tileSize`, `minzoom`/`maxzoom` тайлов, `bounds`, `scheme`, атрибуция, `minZoom` слоя, прозрачность). Функция, а не константа: retina-варианты (Strava `px=512`, swisstopo), `hl=` Google и адрес прокси зависят от среды, а e2e импортирует тот же каталог в Node, чтобы знать, какие тайлы подменять. Группы и порядок — `groupsDefs` и `titlesByOrder` старого клиента без удалённых слоёв.

Перевод опций Leaflet в MapLibre (зум MapLibre на 1 меньше):
- `maxNativeZoom` → `maxzoom` источника (нумерация тайлов та же), без него — 18: старая карта не поднималась выше `maxZoom: 18` ([App.js](../../../src/App.js)), и тайлов глубже слои не запрашивали. Глубже MapLibre растягивает последний зум.
- `minZoom` слоя → `minzoom` слоя MapLibre = `minZoom − 1` (`Mt` 1, `Gbt` 11, `St` 9).
- `bounds` → `bounds` источника `[west, south, east, north]`; у `Fmk` в старом коде опечатка `bound`, теперь прямоугольник применяется. `cutline` отбрасывается.
- `{s}` → массив адресов по поддоменам (Leaflet по умолчанию `abc`, Google — `0123`); retina-пары → `{ratio}` (Thunderforest `@2x`) или выбор адреса по `pixelRatio` (Strava `px=256`/`px=512` с `maxzoom` 16/15, как `retinaOptionsOverrides`); swisstopo — `tileSize: 128`, `maxzoom` 17.
- Google — `z={z}` вместо `zoom={17−z}` (проверено выше); Bing — статичный адрес со `{quadkey}`.
- Прозрачность Strava 0.75 → `raster-opacity`.

### Прокси и конечные адреса **[владелец]**

- Через `config.corsProxyUrl` (формат `urlViaCorsProxy`: `<прокси>https/host/path`) — только Strava (`Sa`, `Sr`, `Sb`, `Sw`) и Tsvetkov (`Mt`): без прокси они не отдают CORS.
- swisstopo (`Si`) — напрямую, хотя задача change и ресёрч говорят «через прокси»: прямой ответ с CORS проверен, прокси добавил бы лишний переход и тратил бы лимит прокси (1200 в минуту на IP) на слой, которому он не нужен. Если swisstopo закроет CORS — вернуть прокси одной строкой каталога.
- `Q`, `Z`, `St` — конечные адреса после редиректа (`tiles.slazav.xyz/{hr,podm}/{z}/{x}/{y}.png`, `tile.mapy.hiking.sk/otm/{z}/{x}/{y}.png`), иначе WebGL их не загрузит.
- `Gbt` (Ordnance Survey) — статичный адрес тайла Bing без ключа сессии, без страницы `bing.com/maps` через прокси. Если Bing начнёт требовать ключ — тайл перестанет грузиться, тост покажет ошибку слоя; тогда вернуть запрос ключа через прокси.

### Отмывка рельефа — оверлей `Hs` **[владелец]**

Код `Hs` (свободен в старом каталоге), название «Relief shading», группа «Miscellaneous», в списке по умолчанию, но не включён. Источник `raster-dem` с `encoding: 'terrarium'`, `tileSize: 256`, `maxzoom: 15` (дальше MapLibre растягивает z15); слой `hillshade` с `hillshade-method: multidirectional`, как в рекомендации ресёрча. Подсветка склонов прозрачная, тени — чёрный с прозрачностью 0.4: белая подсветка MapLibre по умолчанию высветляла растровую подложку так, что дороги и подписи OSM почти не читались (замечание владельца 2026-10-08 после первого показа). В порядке наложения — над непрозрачными картами-оверлеями (`#custom-top`) и под линейными (Waymarked, Strava), чтобы тени ложились на любую подложку и не закрывали тропы. Атрибуция — короткая ссылка «Terrain: Mapzen, sources» на `attribution.md` joerd вместо 11 пунктов в подписи карты: правила OSMF, на которые ссылается joerd, допускают ссылку на страницу с полной атрибуцией.

### Стиль карты собирается из выбора

`web/src/layers/style.ts`: `buildStyle(selection, catalog, customLayers)` — подложка и включённые оверлеи в порядке наложения, один источник и один слой на код (`id` = код). Смена выбора даёт новый объект стиля, `react-maplibre` передаёт его в `setStyle` с diff: источники, которые остались, не перезагружаются. `osm-style.ts` уходит — OSM теперь элемент каталога. Атрибуция — из источников, как у MapLibre по умолчанию.

### Адрес: `hash.ts` + стор Zustand

- `web/src/state/hash.ts` — чистые функции без DOM: `parseHash(hash)` → упорядоченный список `[key, values[]]` (разбор как `parseHashParams`), `formatHash(params)`; `parseView(values)` → `{lat, lng, zoom: zoomLeaflet − 1}` или `null` по правилам `validateState`, но зум — `parseFloat` (новое приложение пишет дробный); `formatView(view)` → `[zoom + 1 с двумя знаками без хвостовых нулей, lat.toFixed(5), lng.toFixed(5)]` — старый клиент прочтёт `parseInt`; `parseLayers(values, catalog)` по правилам `unserializeState` + `loadCustomLayerFromString`. Неизвестные ключи (`nktk`, `nktl`, `q`, `r`, `n2`, `p`…) сохраняются как были, на своих местах: их разбирают следующие changes.
- `web/src/state/store.ts` — Zustand: `view`, `selection` (подложка + оверлеи), `layerSettings` (видимость в списке, свои слои). Синхронизация (`sync.ts`): при старте — адрес, потом `localStorage`, потом умолчания; карта неуправляемая (`initialViewState`), `moveend` пишет `view` в стор; стор → адрес через `history.replaceState` с debounce 300 мс для `m=` и сразу для `l=`; `hashchange` → стор → `map.jumpTo` и смена слоёв. Запись в адрес не порождает `hashchange` (`replaceState` его не шлёт), так что петли нет. Тесты `hash.ts` — набор реальных ссылок (ниже, «Тесты»).

### Настройки — свой ключ, старые читаются

Ключ `nakarte-web:layers` (версия формата в объекте): видимость слоёв в списке, свои слои, последний выбор (подложка + оверлеи). Если ключа нет — читается `leafletLayersSettings` старого клиента: `enabled` по кодам (`hotkey` не переносится), свои слои по `-cs`-кодам, коды удалённых слоёв пропускаются; старый ключ не трогается — старый клиент живёт на том же origin. `layersEnabled` (формат до `leafletLayersSettings`) не читается: старый клиент мигрирует его сам, а на `nakarte-routing.pages.dev` он не появлялся. Чтение `localStorage` — в `try/catch`: без хранилища приложение работает на умолчаниях. Последний выбор применяется, только если в адресе нет годного `l=`.

### Переключатель **[владелец]**

- Кнопка с иконкой слоёв справа сверху, под ней кнопки зума MapLibre; по клику — shadcn `Popover`: подложки радиокнопками, оверлеи чекбоксами; внизу — «Configure layers» и «Add custom layer». Старый контрол был развёрнут всегда; на телефоне развёрнутый список закрывает пол-экрана, поэтому свёрнут по умолчанию на всех экранах.
- Регионального слоя ниже его `minzoom` или вне видимой области не видно, поэтому в списке у такого слоя подпись «zoom ≥ N» (`Gbt`, `St`) вместо пропавшего обзора покрытия.
- «Configure layers» — `Dialog`: все слои по группам с чекбоксом «в списке», кнопки «Reset» (умолчания каталога), «Cancel», «Ok» — как старый диалог.
- **Хоткеев слоёв нет** — решение владельца 2026-10-08 после первого показа переключателя: буквы клавиш в списке и их настройка не нужны. Хоткеи старого клиента в `leafletLayersSettings` не читаются, `l=` и коды слоёв не меняются.

### Свои слои **[владелец]**

- Поля формы и JSON кода — как у старого клиента (`name`, `url`, `tms`, `scaleDependent`, `maxZoom`, `isOverlay`, `isTop`), код `-cs` + URL-safe base64, тот же `\uXXXX` для не-ASCII: ссылка со своим слоем открывается в обоих клиентах, дубликаты ловятся сравнением кодов. `scaleDependent` нужен был только печати — в форме его нет, поле сохраняется из старых кодов как было.
- Новое поле `corsProxy: true`, если слой идёт через прокси. Старый клиент неизвестное поле игнорирует (грузит слой `<img>` без CORS), новый оборачивает адрес в `config.corsProxyUrl`. Полем, а не готовым адресом прокси в `url`: ссылки не зависят от адреса прокси.
- Шаблон адреса переводится в токены MapLibre: `{s}` → адреса `a`, `b`, `c`; `{r}` → `{ratio}`; `{-y}` → `{y}` + `scheme: 'tms'`; `tms` → `scheme: 'tms'`. Токены SAS Planet `{z_1}`, `{x_1024}`, `{y_1024}` MapLibre не умеет, а `transformRequest` получает уже готовый адрес без `z/x/y`; поддержка стоила бы своего протокола `addProtocol` с загрузкой тайлов своим кодом. Форма их отклоняет с сообщением, слой из старой ссылки с ними не добавляется. В реальных ссылках из issues апстрима их нет.
- Проверка CORS при добавлении и сохранении: один тайл в центре текущего вида (зум ограничен `maxZoom` слоя) — `fetch` с `mode: 'cors'`. Не прошло — `fetch` с `mode: 'no-cors'`: если он вернул ответ, сервер жив, но без CORS — форма предлагает «Use proxy» (галочка `corsProxy`) и проверяет снова уже через прокси; если упал и он — «Tile server is not reachable», слой можно сохранить всё равно (тайла в центре может не быть). Прокси принимает любой хост ([cors-proxy](../../specs/cors-proxy/spec.md)), такие запросы считает меньший лимит `OTHER_RATE_LIMITER` — роли прокси не расширяются.

### Тост ошибки тайлов — по слою, без `404` **[владелец]**

Ошибка тайла любого слоя (событие `error` с `sourceId`) даёт тост `Map tiles failed to load` с названием слоя в описании, id тоста — `tile-error:<код>`: один тост на слой. Ответ `404` тоста не даёт: у региональных и разреженных слоёв (Slazav внутри района, тайлы вне покрытия внутри `bounds`) это нормальное «тайла нет». `Nr` (finn.no) вместо `404` отвечает `500` — у него тост возможен у границы Норвегии, это честная ошибка сервера.

### Прокси в dev **[владелец]**

`ALLOWED_ORIGINS` прокси — `nakarte-routing.pages.dev` и порты старого клиента; `localhost:8769` (dev нового приложения) и `4173` (`vite preview`) там нет. Слои через прокси локально не грузятся; проверяются на проде после деплоя. Расширять список — правка и деплой Worker'а ради удобства разработки, отдельным change, если понадобится.

### Тесты

- **Unit (Node):** `hash.ts` на наборе реальных ссылок из issues `wladich/nakarte` (≈ 50 адресов `nakarte.me/#…`, собраны `gh api` 2026-10-08, лежат фикстурой `web/src/state/fixtures/old-links.txt`): `m=` (включая `m=99/…` и неполный `m=11/49.44893/`), `l=` с удалёнными кодами (`F`, `Wp`, `K`, `T`, `Czt`, `Y`, `Ng`, `B`, `M`), без подложки (`l=М` кириллицей, `l=Czt`), хвостовая запятая (`l=O/M,`), свои слои `-cs…` с `tms`, `{x}-{y}-{z}` и `?` в адресе, сохранение `nktl`, `nktk`, `q`, `r`, `n2`, `p` на местах; круговая сборка `parse → format`. Каталог: 30 кодов + `Hs`, нет `Y`, `S`, `W`, `Ng` и кодов из требования «Без слоёв на данных автора»; адреса без `nakarte.me`; Strava и `Mt` через прокси. Свои слои: код ↔ поля (совпадает со старым `serializeCustomLayer` на ссылках из фикстуры), перевод токенов, отказ на `{z_1}`. Настройки: чтение `leafletLayersSettings` со старыми кодами, свой ключ важнее, битый JSON.
- **Browser mode:** `App` получает `transformRequest`: тайлы любых слоёв (растр и DEM) → фикстура `src/test/tile.png`, адрес записывается; запрос, который не тайл каталога или своего слоя, валит тест. Сценарии: смена подложки и оверлея меняет слои карты, порядок наложения, отмывка рельефа даёт слой `hillshade`, тост по слою и без тоста на `404`.
- **e2e:** `fixtures.ts` строит регулярки адресов тайлов из `buildCatalog` (тот же модуль) и подменяет их фикстурой; свой слой — выдуманный хост `tiles.example.test` (с CORS и без, через адрес прокси); всё остальное мимо `localhost` — `abort` и провал теста, как сейчас. Сценарии спек — с теми же названиями: ссылки со слоями и видом, старые коды, сохранение выбора после перезагрузки, свой слой с проверкой CORS и прокси.
- Настоящие тайлы провайдеров — вручную на проде после деплоя (все 31 слой, проверка в браузерной панели).

### Память при нескольких слоях

Слоёв на карте теперь больше одного (подложка + оверлеи + отмывка), поэтому — замер `phys_footprint` (сумма по дереву процессов Chromium, `footprint --pid`, не RSS) на эмуляции Pixel 7, как в архиве [spike-engine-in-worker](../archive/2026-10-08-spike-engine-in-worker/design.md#память-вкладки): только OSM против OSM + `Wh` + `Hs`, после загрузки и после 6 прокруток с зумом, реальные тайлы (скрипт вне репозитория, `vite preview`). Итог — в этот design, раздел «Проверки».

## Risks / Trade-offs

- [Провайдеры меняют адреса и CORS (так случилось со Slazav, hiking.sk, swisstopo)] → тост по слою покажет, какой сломался; проверка всех слоёв — вручную после деплоя. Синтетика прода слои не проверяет.
- [Bing OS без ключа и статичный `g=` Bing могут перестать работать] → вернуть запрос стиля и ключа (решение выше).
- [Регулярки адресов в e2e строятся из каталога — ошибка в шаблоне каталога не поймается e2e] → unit-тест каталога сверяет адреса с образцами `src/layers.js` для каждого кода.
- [Свои слои через прокси считаются меньшим лимитом прокси] → тот же лимит, что у импорта по ссылкам; при `429` тост слоя.
- [Нет обзора покрытия для `Gbt`, `St`, `Mt` на мелком масштабе] → подпись «zoom ≥ N»; полигоны можно вернуть GeoJSON-слоем позже.

## Migration Plan

1. PR в `master`, `check web` зелёный.
2. Merge → `deploy pages` выкатывает `/next/` со слоями.
3. На проде: все слои по очереди в браузерной панели (тайлы, CORS, прокси для Strava и `Mt`), ссылка из старого клиента с `l=` открывается в `/next/`, настройки старого клиента подхватываются. Итог — в этот design, архив — вторым PR.
4. Откат — revert и push.
