# Свои бэкенды вместо `*.nakarte.me`

Ресёрч 2026-10-07 для направления «полная автономия» из `openspec/backlog.md`. Документ — вход для нарезки changes и для агентов, которые будут их реализовывать. Каждый пункт плана ниже — отдельный change (`/opsx:propose`), правила тестов — в `openspec/config.yaml` и в `AGENTS.md`, раздел «Свои бэкенды».

## Решения владельца

- Цель — полная независимость от инфраструктуры автора.
- Обратная совместимость с сервисами автора не нужна: клона нет в продакшене. Старые ссылки `nktl=` на `tracks.nakarte.me` не поддерживаем, откат на сервер автора не делаем.
- Хостинг — Cloudflare, план Workers Paid ($5 в месяц). Включает и оплачивает владелец; агент токены и биллинг не трогает.
- Данные высот — DEM 3″ viewfinderpanoramas, те же, что у автора (решение 2026-10-07 в `add-elevation-api`, GLO-30 отложен в backlog), сервис высот на Rust.
- Перевалы и геокешинг — свои скраперы, а не зеркало файлов автора.
- 17 слоёв сканов карт автора, слои перевалов Вестры и geocaching.su удаляем из кода (решение 2026-10-08, `drop-author-scan-layers`).

## Карта бэкендов

Ключи — из `src/config.js`, слева — адрес автора, который там был. С `drop-author-services` (2026-10-08) свои Worker'ы — значения по умолчанию в `src/config.js` для всех сборок, `src/config-target/clone.js` держит только движок в браузере и путь тайлов BRouter, а деплой проверяет бандл на адреса `*.nakarte.me` (`scripts/check-no-author-hosts.mjs`).

| Ключ / адрес | Кто использует | Что делаем |
|---|---|---|
| `tracksStorageServer` = `https://tracks.nakarte.me` | ссылка «Copy link» (`nktl=`) | свой Worker + R2 (`nakarte-tracks`) |
| `elevationsServer` = `https://elevation.nakarte.me/` | профиль высот, экспорт с высотами, внешние карты | свой API высот на Rust (`nakarte-elevation`) |
| `elevationTileUrl` = `https://tiles.nakarte.me/elevation/{z}/{x}/{y}` | высота и уклон под курсором | свои тайлы из тех же данных (`nakarte-elevation`) |
| `westraDataBaseUrl` = `https://nakarte.me/westraPasses/` | слой перевалов | слой, его код и ключ удалены (`drop-author-scan-layers`); свои данные — `openspec/backlog.md` |
| `geocachingSuUrl` = `https://nakarte.me/geocachingSu/geocaching_su2.json` | слой geocaching.su | слой, его код и ключ удалены (`drop-author-scan-layers`); свои данные — `openspec/backlog.md` |
| `wikimediaCommonsCoverageUrl` = `https://tiles.nakarte.me/wikimedia_commons_images/{z}/{x}/{y}` | покрытие фото Wikimedia Commons | отменено: провайдер удалён из кода (`remove-panorama-providers`) |
| `mapillaryRasterTilesUrl` = `https://mapillary.nakarte.me/{z}/{x}/{y}` | покрытие Mapillary | отменено: провайдер удалён из кода (`remove-panorama-providers`) |
| `CORSProxyUrl`, `wikimapiaTilesBaseUrl` = `https://proxy.nakarte.me/…` | импорт треков по ссылкам, слои через прокси, поиск, печать | свой Worker `nakarte-cors-proxy`; куки Strava heatmap он получает сам по сессии из секрета `STRAVA_SESSION` (заводит владелец, `add-strava-heatmap-refresh`), без сессии — анонимные тайлы до z12 (`add-strava-anonymous-fallback`) |
| `https://proxy.nakarte.me/mapy/...` (захардкожено в `src/layers.js` и `leaflet.control.panoramas/lib/mapycz`) | слои mapy.cz, панорамы | слои удалены (`drop-author-services`): ключа mapy.cz нет; панорама mapy.cz удалена (`remove-panorama-providers`) |
| `caption` (docs, news, donate, почта) | подпись карты | название и ссылка на репозиторий форка (`drop-author-services`) |
| `eventsLogUrl`, `sentryDSN` | логирование | пустые во всех сборках, Sentry без DSN не инициализируется (`drop-author-services`) |
| `{s}.tiles.nakarte.me/...`, `tiles.nakarte.me/topomapper/...` — 17 слоёв | сканы карт | удалены из кода (`drop-author-scan-layers`) |

Слои сканов: Soviet topo maps (AtloMaps), Topo 10km, GGC 2km, ArbaletMO, GGC 1km, Topo 1km, GGC 500m, Topo 500m, GGC 250m, Races, O-sport, Eurasia 25km, Caucasus 1km, Caucasus 500m, Topo 250m, Montenegro topo 250m, Mountains by Alexander Purikov.

## Контракты, которые ждёт клиент

Клиент не меняем, если не сказано обратное: новый сервис повторяет контракт, клон меняет только URL в `config-target`.

### Хранилище треков

- `POST {tracksStorageServer}/track/{key}`, тело — строка nktk (`serializeTracks`, треки через `/`). `key` = base64url(md5(тело)) без `=`: `btoa(md5(serialized, null, true))` с заменой `/`→`_`, `+`→`-` (`track-list.js`, `copyTracksLinkToClipboard`).
- `GET {tracksStorageServer}/track/{key}` возвращает то же тело (`services/nakarte/index.js`, `responseType: 'binarystring'`).
- Слишком большой трек — `413`, клиент показывает «track is too big».
- Запросы идут с `withCredentials: true`: CORS обязан отражать `Origin` и отдавать `Access-Control-Allow-Credentials: true`, `*` не подойдёт.
- Сервер сверяет ключ с md5 тела и отклоняет несовпадение, иначе можно перезаписать чужой трек.

### API высот

- `POST {elevationsServer}`, тело — строки `"lat lng"` с 6 знаками, разделитель `\n` (`src/lib/elevations/index.js`). Клиент режет запрос на куски по 10 000 точек.
- Ответ — по строке на точку в том же порядке: высота в метрах с 2 знаками (`%.2f`) или `NULL`.
- Лимиты сервера автора: 10 000 точек и 250 000 байт на запрос ([elevation_server.py](https://raw.githubusercontent.com/wladich/ElevationServer/master/elevation_server.py)).
- CORS с `credentials`, как у треков.
- Сейчас у автора сетка 3″ (~90 м) с билинейной интерполяцией: проверено 2026-10-07 профилями с шагом 0.25″ (Казбек, Эльбрус, Альпы), изломы ровно через 3″. Работает Go-сервер [wladich/elevation_server](https://github.com/wladich/elevation_server) (тексты ошибок совпадают с его кодом, а не с архивным Python-сервером `ElevationServer`): HGT 1201×1201 с [viewfinderpanoramas](https://viewfinderpanoramas.org/dem3.html), градус режется на 4×4 куска 301×301, lz4. Высоты автора в узлах сетки совпадают с HGT viewfinderpanoramas до метра. Точный контракт — в `openspec/specs/elevation-api` и `openspec/changes/archive/2026-10-07-add-elevation-api/design.md`.

### Тайлы высот

- `GET {elevationTileUrl}` для z0–11 (`maxNativeZoom: 11`), выше клиент интерполирует сам (`src/lib/leaflet.layer.elevation-display/index.js`).
- Тело — 256×256 `Int16` little-endian, построчно, дельта-кодирование: первое значение как есть, каждое следующее — разность с предыдущим (клиент делает префиксную сумму). `-512` — нет данных. У автора отдаётся с `Content-Encoding: gzip`, 131 072 байта после распаковки.
- `404` — нет данных для тайла, клиент это обрабатывает.
- CORS: `Access-Control-Allow-Origin: *`.

### Перевалы и геокешинг

- Перевалы (клиент удалён в `drop-author-scan-layers`, код — в истории git и `upstream/master`): клиент брал с `westraDataBaseUrl` файлы `westra_passes2.json`, `westra_coverage.json`, `westra_regions_labels1.json`, `westra_regions_labels2.json` (`src/lib/leaflet.layer.westraPasses/`). У автора `westra_passes2.json` ≈ 7.4 МБ без сжатия, обновляется ежедневно.
- Геокешинг (клиент удалён там же): один JSON `geocaching_su2.json` (`src/lib/leaflet.layer.geocaching-su/`), ≈ 0.8 МБ в gzip.
- Схему JSON агент снимает с текущих файлов автора и фиксирует как фикстуры теста; скрапер обязан выдавать ту же схему.

## Сервис высот

### Данные

Решение 2026-10-07 (`add-elevation-api`): DEM 3″ viewfinderpanoramas, те же данные, что у автора — 1127 zip, 16.6 ГБ, условия сайта разрешают использование с атрибуцией и ссылкой. Ниже — исходный разбор GLO-30, он остаётся входом для перехода на 1″ (пункт в `openspec/backlog.md`).

Copernicus GLO-30, релиз 2024_1 (на AWS лежит релиз 2021 без части стран; свежий — Copernicus Data Space или OpenTopography).

| | GLO-30 | GLO-90 |
|---|---|---|
| Шаг сетки | 1″ ≈ 30 м | 3″ ≈ 90 м, как у автора |
| Исходники на AWS (релиз 2021) | 26 450 тайлов, 589 ГБ | 26 475 тайлов, 71 ГБ |
| R2 за исходный объём | ≈ $8.7/мес | ≈ $1/мес |

Объёмы посчитаны `aws s3 ls` 2026-10-07; после перепаковки в Int16 будет меньше, не измерялось.

- Почему GLO-30: на 90 м гребни, перевалы и серпантины сглаживаются, набор высоты занижен. По оценке по LiDAR и ICESat-2 Copernicus — лучшая глобальная DEM ([Guth & Geoffroy 2021](https://doi.org/10.1111/tgis.12825)).
- Минус: это DSM, в лесу и в городе высота по верхушкам и крышам.
- Лицензия разрешает распространение и модификацию; обязательны атрибуция «© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved» и дисклеймер ([лицензия](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf)). Атрибуцию показать в UI.
- Отклонены: SRTM/NASADEM (нет данных севернее 60°), MERIT (запрет перераздачи), viewfinderpanoramas (массовое перераздавание — по согласованию с автором; пересмотрено: API файлы не перераздаёт, выбран в `add-elevation-api`), AWS Terrain Tiles (смесь источников, другой формат, севернее 60° на средних зумах — GMTED).

### Архитектура

- Офлайн-утилита на Rust перепаковывает HGT в Int16-куски 301×301 (как у автора), zstd от дельт, по объекту на градус с индексом смещений.
- Ядро на Rust без ввода-вывода: разбор запроса, поиск куска, билинейная интерполяция, `NULL` без данных, сборка ответа. Два адаптера: `workers-rs` + R2 (основной) и `axum` + диск (запасной, для VPS).
- Тайлы высот z0–11 — из тех же кусков: генерация на лету в Worker с Cache API или один архив PMTiles в R2. Не заливать 5.6 млн тайлов отдельными объектами: только запись ≈ $21 разово.
- Если тайлы не требуют отдельного пайплайна, API и тайлы — один change.

### Ограничения Workers (Paid)

- 128 МБ памяти на изолят, включая wasm: исходные COG (тайл 1024² Float32 ≈ 4 МБ после распаковки) читать нельзя, только мелкие перепакованные куски.
- CPU на запрос: по умолчанию 30 с, максимум 5 мин; на Free — 10 мс, поэтому нужен Paid.
- 10 000 подзапросов на вызов, вызовы R2 входят в лимит: пакет из 10 000 точек касается десятков–сотен кусков.
- В wasm32 нет потоков и tokio.
- Источник: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Хостинг

Всё на Cloudflare: Workers Paid $5 + R2 за DEM 3″ (оценка 10–20 ГБ, ≈ $0.2–0.3) + мелочь ≈ $5–6 в месяц (с GLO-30 было бы ≈ $6–7), egress бесплатный. Ядро высот портируемое: при упоре в лимиты API переезжает на VPS (адаптер `axum`).

| Бэкенд | Где |
|---|---|
| Хранилище треков | Worker + R2 |
| API высот | Worker (Rust) + R2 |
| Тайлы высот | тот же Worker: z0–9 — архив с плотным индексом в R2, z10–11 — на лету |
| Скраперы | Cron Trigger → R2; если нужен долгий прогон или браузер — пересмотреть |
| Покрытия | не нужны: в клоне панорамы только Google Street View |

Hetzner рассмотрен (CAX11 + Object Storage ≈ €12.5 + VAT): дешевле не выходит, добавляет администрирование и защиту от DDoS; 2026-10-07 все CX/CAX на странице Hetzner помечены «currently unavailable».

## Структура репозитория

Монорепо: все сервисы живут в этом репозитории, каждый деплоится и откатывается отдельно. Так контракт сервиса и правка клиента или `config-target` идут одним PR, а спеки и этот документ лежат рядом с кодом. Каталог `workers/` уже числится среди файлов только форка, с апстримом не конфликтует.

- `workers/tracks/` — хранилище треков.
- `workers/elevation/` — Rust-воркспейс: `core` (без ввода-вывода), `worker` (адаптер `workers-rs`), `server` (адаптер `axum`), `repack` (перепаковка DEM).
- `workers/scrapers/` — скраперы перевалов и геокешинга на Cron Trigger (отложено, см. `openspec/backlog.md`).
- У каждого сервиса свой `wrangler.toml` и свой workflow `.github/workflows/check-<сервис>.yml` с фильтром `paths:` на свой каталог. `main.yml` (workflow `check`) — файл апстрима, его не трогаем.
- Сервис высот можно вынести в отдельный репозиторий, если он станет самостоятельным продуктом: воркспейс переносится целиком.

## План changes

Порядок — по возрастанию риска. Каждый change: отдельный ключ в `config-target/clone.js`, тесты в CI без сети, проверка клиента в браузере.

1. **Хранилище треков.** Worker + R2, проверка md5-ключа, `413`, CORS с `credentials`. Тесты в рантайме Workers (`@cloudflare/vitest-pool-workers` или аналог). Заодно отрабатывается шаблон деплоя сервиса.
2. **API высот на Rust.** Утилита перепаковки, ядро, адаптер `workers-rs`, контрактный тест: формат ответа совпадает с автором, высоты на эталонных точках в пределах допуска (эталоны снять заранее и положить фикстурами). Атрибуция viewfinderpanoramas в UI.
3. **Тайлы высот.** Генерация в формате клиента, тест декодирования и сверки с эталонным тайлом. Возможно, внутри change 2.
4. **Скраперы перевалов и геокешинга.** Отложено 2026-10-07 (итоги ресёрча — `openspec/backlog.md`), слои сначала скрыты в клоне, потом удалены из кода (`drop-author-scan-layers`). Сначала проверить условия использования westra.ru и geocaching.su. Cron Trigger → R2, тесты на сохранённых страницах источников, проверка схемы JSON против фикстур от файлов автора.
5. **Покрытия Wikimedia Commons и Mapillary.** Отменено решением владельца: в панорамах только Google Street View; Wikimedia Commons, Mapillary и mapy.cz сначала скрыты в клоне (`hide-panorama-providers`, 2026-10-07), потом удалены из кода (`remove-panorama-providers`, 2026-10-08).
6. **Без сервисов автора.** Решение владельца 2026-10-08: свои сервисы — значения по умолчанию в `src/config.js`, слои mapy.cz удалить (ключа нет), свои ссылки в `caption`, проверка бандла в деплое.
7. **Убрать слои сканов.** Решение владельца 2026-10-08: удалить 17 слоёв из `src/layers.js` во всех сборках, а не прятать фильтром — в апстрим мы не мерджимся (`AGENTS.md`, «Апстрим»). Тем же change удалены слои перевалов Вестры и geocaching.su и фильтр `excludedLayerCodes`.

### Changes в `openspec/changes/`

| № | Change | Архивировать после | Статус |
|---|---|---|---|
| 1 | `add-track-storage` | — | в проде и в архиве с 2026-10-07, шаблон сервиса — `workers/tracks/` |
| 2 | `add-elevation-api` | 1 (убирает требование, которое добавляет 1) | в проде и в архиве с 2026-10-07: данные viewfinderpanoramas 3″ всего мира, сервис `workers/elevation` |
| 3 | `add-elevation-tiles` | 2 (данные и ядро) | в проде и в архиве с 2026-10-07: z0–9 — архив в R2, z10–11 — на лету в `workers/elevation`, значения совпадают с тайлами автора |
| 4 | `add-map-data-scrapers` | — | отложено 2026-10-07: источники требуют ключа или согласия (итоги — `openspec/backlog.md`), слои скрыты в клоне (`hide-map-data-layers`, архив 2026-10-07), потом удалены из кода вместе с фильтром (`drop-author-scan-layers`) |
| 5 | `add-photo-coverage-tiles` → `hide-panorama-providers` | — | `add-photo-coverage-tiles` удалён 2026-10-07: решение владельца — панорамы клона только Google Street View; `hide-panorama-providers` скрыл Wikimedia Commons, Mapillary и mapy.cz (в архиве с 2026-10-07), `remove-panorama-providers` удалил их код (в проде и в архиве с 2026-10-08) |
| 6 | `drop-author-services` | всех остальных: закрывает требование «без запросов к `*.nakarte.me`» | в проде и в архиве с 2026-10-08: свои сервисы по умолчанию, слои mapy.cz удалены, проверка бандла в деплое; Strava heatmap — по сессии `STRAVA_SESSION` и анонимно до z12 (2026-10-08) |
| 7 | `drop-author-scan-layers` | — | в проде и в архиве с 2026-10-08: 17 слоёв сканов, `Wp` и `Gc` удалены из кода во всех сборках, фильтр `excludedLayerCodes` удалён |

## Открытые вопросы

- Объём DEM 3″ после перепаковки и время пайплайна — измерить в change 2.
- Условия использования westra.ru и geocaching.su — проверены 2026-10-07, итоги в `openspec/backlog.md`: JSON API Вестры только с ключом, geocaching.su — только с согласия администрации.
- Как генерировать покрытие Wikimedia Commons — закрыто: покрытие не делаем, провайдер удалён из кода.
