# Снимки по датам

Ресёрч 2026-10-12 по пункту backlog «Спутниковый слой с выбором даты» (№ 2 таблицы [changes слоёв](map-layers.md#changes-по-порядку)): можно ли в клоне посмотреть снимок района за конкретную дату, например, лежит ли ещё снег на перевале. Мозаика `S2` ([архив `add-sentinel-imagery`](../changes/archive/2026-10-11-add-sentinel-imagery/design.md)) этого не даёт: это годовой композит без облаков. Факты — по первоисточникам, ссылка у каждого. Ответы сервисов и CORS проверены `curl` с `Origin: https://nakarte-routing.pages.dev` 2026-10-12 на районе Казбеги: квадрат MGRS `38TMN`, тайл z12 `2554/1509`, bbox `44.4,42.6,44.7,42.8`. Решения владельца помечены **[владелец]**, рекомендации агента — **[агент]**. Каждый change переносит свои решения в свой design; документ остаётся справкой.

## Итог

Решение владельца 2026-10-12: делать слой HLS 30 м — change `add-dated-imagery` после `add-contour-lines`; про 10 м решать потом, если 30 м окажется мало **[владелец]**.

Делать **[агент]**: снимки по датам показываются без своего бэкенда, без ключа и без денег на Cloudflare.

- Первый шаг — слой HLS (Sentinel-2 и Landsat, приведённые к 30 м) из NASA GIBS с выбором даты. Даты и облачность над районом даёт STAC Earth Search. Браузер ходит в оба сервиса напрямую: оба отвечают `Access-Control-Allow-Origin: *`. У Казбеги 2026-10-05 на тайле z12 снег на массиве виден.
- 10 м Sentinel-2 — только если 30 м окажется мало, и сначала spike: COG лежат в UTM, перепроецировать и склеивать снимки придётся в браузере самим.
- Sentinel Hub в Copernicus Data Space — нет: квота аккаунта — 10 000 запросов в месяц на всех пользователей.
- Свой тайлер на Cloudflare — нет: платим за каждый тайл, а GIBS отдаёт готовые тайлы бесплатно; к нему возвращаться, только если 10 м в браузере не выйдет.

## Источники снимков

| Источник | Разрешение | Частота | Лицензия и подпись |
|---|---|---|---|
| Sentinel-2 (A, B, C) | 10 м у четырёх каналов (RGB и NIR), полоса 290 км ([CDSE](https://dataspace.copernicus.eu/explore-data/data-collections/sentinel-data/sentinel-2)) | двумя спутниками — 5 дней на экваторе (там же); S2A работает сверх штатной пары до 31.12.2026 ([ESA, 30.04.2026](https://sentinels.copernicus.eu/-/sentinel-2a-extension-campaign-prolonged-until-the-end-of-2026)) | бесплатно всем, включая коммерческих пользователей (CDSE, там же); подпись «Contains modified Copernicus Sentinel data [год]» ([лицензия](https://ads.atmosphere.copernicus.eu/licences/ec-sentinel)) |
| Landsat 8 и 9 | 30 м, панхроматический канал 15 м | 16 дней у каждого ([HLS](https://www.earthdata.nasa.gov/data/projects/hls)) | «no restrictions … can be used or redistributed as desired» ([Registry of Open Data](https://registry.opendata.aws/usgs-landsat/)) |
| HLS — Sentinel-2 (`S30`) и Landsat (`L30`), приведённые к общей сетке | 30 м | вместе — снимок раз в 1.6 дня, задержка 2–3 дня, быстрые продукты — в 2027 ([HLS](https://www.earthdata.nasa.gov/data/projects/hls)) | лицензии исходных данных |
| MODIS, VIIRS (true color в GIBS) | матрица GIBS до z9 — ≈ 300 м на пиксель на экваторе | ежедневно | открытые данные NASA ([GIBS](https://nasa-gibs.github.io/gibs-api-docs/)) |

Реальная частота у Казбеги по Earth Search: с 2026-09-01 по 2026-10-12 — 20 дат съёмки (S2A, S2B, S2C), из них облачность квадрата ниже 10 % — у пяти (09-10, 09-12, 09-14, 10-05, 10-10). Облачность — `eo:cloud_cover` на весь квадрат 110 км: над самим перевалом может быть иначе.

## Как показать

### NASA GIBS: готовый WMTS с датой

- Слои `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` и `HLS_L30_Nadir_BRDF_Adjusted_Reflectance`, матрица `GoogleMapsCompatible_Level12` (z0–12), PNG; шаблон `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<слой>/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`; данные S30 — с 2015-11-28, дата по умолчанию на 2026-10-12 — 2026-10-10 ([WMTSCapabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)). Там же MODIS и VIIRS true color (`…_CorrectedReflectance_TrueColor`, z0–9, JPEG) и снежный покров MODIS NDSI (z0–8).
- Ключа и регистрации нет; лимитов и SLA в [документации](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) нет. NASA просит в клиенте подпись «We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)» ([Data Use Guidance](https://nasa-gibs.github.io/gibs-api-docs/)).
- `curl`: тайл — `200`, `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=0, no-store`; z13 — `400`, то есть выше z12 только overzoom (`maxzoom` источника). Дата без съёмки над тайлом — `200` с прозрачным PNG ≈ 0.2–1 КБ, не `404`. В заголовках `layer-time-actual` — фактическая дата.
- `DescribeDomains` по bbox (`…/1.0.0/<слой>/default/<матрица>/<bbox>/<с>--<по>.xml`) для HLS вернул весь мир и сплошной диапазон дат: в каком районе есть снимок, GIBS не говорит. Облачность не фильтрует.

### Earth Search: даты, облачность и COG Sentinel-2 10 м

- STAC API Element 84 поверх AWS Open Data, коллекция `sentinel-2-l2a`; COG в бакете `sentinel-cogs` (us-west-2), новые сцены — «usually within few hours» после публикации Copernicus, доступ без аккаунта AWS ([Registry of Open Data](https://registry.opendata.aws/sentinel-2-l2a-cogs/)).
- `curl`: `/v1/search?collections=sentinel-2-l2a&bbox=…&datetime=…` — `200`, `Access-Control-Allow-Origin: *`; у сцены `datetime`, `platform`, `eo:cloud_cover` и ассеты `visual` (`TCI.tif`, true color 10 м), `thumbnail` (`preview.jpg`, 43 КБ на весь квадрат).
- `TCI.tif` одной сцены — 277 МБ; Range — `206` с `Content-Range`, CORS `*`, preflight разрешает заголовок `range`, `Cache-Control: max-age=31536000, immutable`. `Access-Control-Expose-Headers` нет: браузер не увидит `Content-Range`, а `geotiff.js` берёт из него размер файла ([`remote.js`](https://github.com/geotiffjs/geotiff.js/blob/master/src/source/remote.js)) — работает ли без него, не проверено.
- Снимки лежат в UTM своего квадрата MGRS. `maplibre-cog-protocol` читает только EPSG:3857 и «does not reproject» ([README](https://github.com/geomatico/maplibre-cog-protocol)): перепроекцию в Web Mercator и склейку соседних квадратов писать самим — в Web Worker через протокол MapLibre (`addProtocol`).

### Sentinel Hub в Copernicus Data Space

- OGC WMTS `https://sh.dataspace.copernicus.eu/ogc/wmts/<INSTANCE_ID>` с `TIME` и фильтром облачности `MAXCC`; ID конфигурации в адресе и есть авторизация ([примеры OGC](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/Examples.html)). `curl`: CORS отражает `Origin`.
- Квота Copernicus General user: 10 000 запросов и 10 000 PU в месяц, по 300 в минуту ([квоты](https://documentation.dataspace.copernicus.eu/Quotas.html)); 1 PU — выход 512×512 из трёх каналов ([PU](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/ProcessingUnit.html)). Что будет при исчерпании — не сказано.
- ID в публичном приложении — квота владельца на всех: экран 1280×800 тайлами 512 — 6–12 запросов, то есть ≈ 800–1 600 показов экрана в месяц на всех пользователей. Не подходит **[агент]**. Вход каждого пользователя своим аккаунтом CDSE — не проверялось.

### Свой тайлер на Cloudflare

Worker читает COG из `sentinel-cogs`, перепроецирует и отдаёт тайлы 3857. Платим за каждый тайл: $0.30 за миллион запросов плюс CPU $0.02 за миллион мс ([цены и формулы](security-audit.md#цены-и-как-считаем)); CPU на тайл (распаковка блоков COG и перепроекция) не мерился. Нужна та же защита, что у прокси: лимит частоты по IP ([итог аудита](security-audit.md#итог)). Имеет смысл, только если перепроекция в браузере окажется тяжела для телефонов **[агент]**.

Не рассматривались: коммерческие снимки (платные) и ссылка на снимок в Copernicus Browser (формат ссылки не проверялся).

## Цена и злоупотребления

GIBS и Earth Search браузер зовёт напрямую, Worker'ы клона в цепочке не участвуют: на Cloudflare — $0, и флуд этих слоёв денег владельца не тратит. Риск другой: лимиты у NASA и Element 84 не опубликованы, при блокировке или падении слой пустеет, как любой тайловый слой. У GIBS `no-store`: каждый показ — заново из сети.

## Что решить в change

- Слой каталога с датой: код для `l=`, где хранить дату (параметр адреса или состояние слоя), что по умолчанию — последняя дата с малой облачностью над центром карты или дата по умолчанию GIBS.
- Список дат: запрос Earth Search по bbox экрана, облачность квадрата, отсев повторов одной даты (у сцен бывают версии обработки `_0` и `_1`). Свежая дата из Earth Search может ещё не дойти до GIBS (задержка HLS 2–3 дня): прозрачный тайл — подсказка «снимка ещё нет».
- S30 и L30: показывать оба или только S30; коллекцию Landsat в Earth Search для дат L30 не проверял.
- Подпись: GIBS, «Contains modified Copernicus Sentinel data <год>», USGS для Landsat.
- Тесты: тайлы GIBS — фикстура каталога, ответ Earth Search — фикстура (тесты в сеть не ходят, AGENTS.md, «Свои бэкенды»). Прод: проверка GIBS и Earth Search в `scripts/prod-check.sh`.

## Changes по порядку

| # | Change | Что | Решения |
|---|---|---|---|
| 1 | `add-dated-imagery` | слой HLS из GIBS с выбором даты, список дат с облачностью из Earth Search | владелец 2026-10-12: делать, после `add-contour-lines`; сделано — [архив](../changes/archive/2026-10-12-add-dated-imagery/design.md) |
| 2 | `spike-sentinel-cog` | spike: COG Sentinel-2 10 м из `sentinel-cogs` в браузере — перепроекция и склейка в Web Worker, объём трафика и время на телефоне; итог — делать ли слой 10 м | **[агент]**; владелец 2026-10-12: решать после `add-dated-imagery`, если 30 м мало |
