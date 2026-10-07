# Свои бэкенды вместо `*.nakarte.me`

Ресёрч 2026-10-07 для направления «полная автономия» из `openspec/backlog.md`. Документ — вход для нарезки changes и для агентов, которые будут их реализовывать. Каждый пункт плана ниже — отдельный change (`/opsx:propose`), правила тестов — в `openspec/config.yaml` и в `AGENTS.md`, раздел «Свои бэкенды».

## Решения владельца

- Цель — полная независимость от инфраструктуры автора.
- Обратная совместимость с сервисами автора не нужна: клона нет в продакшене. Старые ссылки `nktl=` на `tracks.nakarte.me` не поддерживаем, откат на сервер автора не делаем.
- Хостинг — Cloudflare, план Workers Paid ($5 в месяц). Включает и оплачивает владелец; агент токены и биллинг не трогает.
- Данные высот — Copernicus GLO-30, сервис высот на Rust.
- Перевалы и геокешинг — свои скраперы, а не зеркало файлов автора.
- 17 слоёв сканов карт автора убираем из клона.

## Карта бэкендов

Ключи — из `src/config.js`, у клона переопределяются в `src/config-target/clone.js`.

| Ключ / адрес | Кто использует | Что делаем |
|---|---|---|
| `tracksStorageServer` = `https://tracks.nakarte.me` | ссылка «Copy link» (`nktl=`) | свой Worker + R2 |
| `elevationsServer` = `https://elevation.nakarte.me/` | профиль высот, экспорт с высотами, внешние карты | свой API высот на Rust |
| `elevationTileUrl` = `https://tiles.nakarte.me/elevation/{z}/{x}/{y}` | высота и уклон под курсором | свои тайлы из тех же данных |
| `westraDataBaseUrl` = `https://nakarte.me/westraPasses/` | слой перевалов | скрапер westra.ru → R2 |
| `geocachingSuUrl` = `https://nakarte.me/geocachingSu/geocaching_su2.json` | слой geocaching.su | скрапер geocaching.su → R2 |
| `wikimediaCommonsCoverageUrl` = `https://tiles.nakarte.me/wikimedia_commons_images/{z}/{x}/{y}` | покрытие фото Wikimedia Commons | генерируем сами |
| `mapillaryRasterTilesUrl` = `https://mapillary.nakarte.me/{z}/{x}/{y}` | покрытие Mapillary | генерируем сами |
| `https://proxy.nakarte.me/mapy/...` (захардкожено в `src/layers.js` и `leaflet.control.panoramas/lib/mapycz`) | слои mapy.cz, панорамы | перевести на свой прокси `nakarte-cors-proxy` |
| `caption` (docs, news, donate, почта) | подпись карты | свои ссылки |
| `eventsLogUrl`, `sentryDSN` | логирование | в клоне уже выключено |
| `{s}.tiles.nakarte.me/...`, `tiles.nakarte.me/topomapper/...` — 17 слоёв | сканы карт | убрать из клона |

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
- Сейчас у автора сетка 3″ (~90 м) с билинейной интерполяцией: проверено 2026-10-07 профилями с шагом 0.25″ (Казбек, Эльбрус, Альпы), изломы ровно через 3″. Сервер — [wladich/ElevationServer](https://github.com/wladich/ElevationServer) (Python, в архиве): HGT 1200×1200, градус режется на 16 подтайлов, zlib, SQLite. Источник HGT не указан.

### Тайлы высот

- `GET {elevationTileUrl}` для z0–11 (`maxNativeZoom: 11`), выше клиент интерполирует сам (`src/lib/leaflet.layer.elevation-display/index.js`).
- Тело — 256×256 `Int16` little-endian, построчно, дельта-кодирование: первое значение как есть, каждое следующее — разность с предыдущим (клиент делает префиксную сумму). `-512` — нет данных. У автора отдаётся с `Content-Encoding: gzip`, 131 072 байта после распаковки.
- `404` — нет данных для тайла, клиент это обрабатывает.
- CORS: `Access-Control-Allow-Origin: *`.

### Перевалы и геокешинг

- Перевалы: клиент берёт с `westraDataBaseUrl` файлы `westra_passes2.json`, `westra_coverage.json`, `westra_regions_labels1.json`, `westra_regions_labels2.json` (`src/lib/leaflet.layer.westraPasses/`). У автора `westra_passes2.json` ≈ 7.4 МБ без сжатия, обновляется ежедневно.
- Геокешинг: один JSON `geocaching_su2.json` (`src/lib/leaflet.layer.geocaching-su/`), ≈ 0.8 МБ в gzip.
- Схему JSON агент снимает с текущих файлов автора и фиксирует как фикстуры теста; скрапер обязан выдавать ту же схему.

## Сервис высот

### Данные

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
- Отклонены: SRTM/NASADEM (нет данных севернее 60°), MERIT (запрет перераздачи), viewfinderpanoramas (массовое перераздавание — по согласованию с автором), AWS Terrain Tiles (смесь источников, другой формат, севернее 60° на средних зумах — GMTED).

### Архитектура

- Офлайн-утилита на Rust (крейт `gdal` или чистый Rust: `async-tiff`, `georaster`) перепаковывает GLO-30 в Int16-куски ~256×256, zstd или deflate, по файлу на градус с индексом смещений.
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

Всё на Cloudflare: Workers Paid $5 + R2 ≈ $8.7 за DEM + мелочь ≈ $14–16 в месяц, egress бесплатный. Ядро высот портируемое: при упоре в лимиты API переезжает на VPS (адаптер `axum`).

| Бэкенд | Где |
|---|---|
| Хранилище треков | Worker + R2 |
| API высот | Worker (Rust) + R2 |
| Тайлы высот | тот же Worker + Cache API или PMTiles в R2 |
| Скраперы | Cron Trigger → R2; если нужен долгий прогон или браузер — пересмотреть |
| Покрытия | генерация офлайн или по Cron → R2 |

Hetzner рассмотрен (CAX11 + Object Storage ≈ €12.5 + VAT): дешевле не выходит, добавляет администрирование и защиту от DDoS; 2026-10-07 все CX/CAX на странице Hetzner помечены «currently unavailable».

## План changes

Порядок — по возрастанию риска. Каждый change: отдельный ключ в `config-target/clone.js`, тесты в CI без сети, проверка клиента в браузере.

1. **Хранилище треков.** Worker + R2, проверка md5-ключа, `413`, CORS с `credentials`. Тесты в рантайме Workers (`@cloudflare/vitest-pool-workers` или аналог). Заодно отрабатывается шаблон деплоя сервиса.
2. **API высот на Rust.** Утилита перепаковки, ядро, адаптер `workers-rs`, контрактный тест: формат ответа совпадает с автором, высоты на эталонных точках в пределах допуска (эталоны снять заранее и положить фикстурами). Атрибуция Copernicus в UI.
3. **Тайлы высот.** Генерация в формате клиента, тест декодирования и сверки с эталонным тайлом. Возможно, внутри change 2.
4. **Скраперы перевалов и геокешинга.** Сначала проверить условия использования westra.ru и geocaching.su. Cron Trigger → R2, тесты на сохранённых страницах источников, проверка схемы JSON против фикстур от файлов автора.
5. **Покрытия Wikimedia Commons и Mapillary.** Свой пайплайн генерации растров; для Mapillary нужен API-токен (заводит владелец).
6. **Прокси mapy и подпись карты.** `proxy.nakarte.me/mapy/...` → `nakarte-cors-proxy`, свои ссылки в `caption`.
7. **Убрать слои сканов в клоне.** Список кодов исключённых слоёв в `config-target/clone.js` и фильтр при сборке списка слоёв, без удаления из `src/layers.js`, чтобы дифф с апстримом остался маленьким.

## Открытые вопросы

- Объём GLO-30 после перепаковки в Int16 и время пайплайна — измерить в change 2.
- Условия использования westra.ru и geocaching.su — проверить в начале change 4.
- Как именно генерировать покрытие Wikimedia Commons (дамп геометок или API) — решить в change 5.
