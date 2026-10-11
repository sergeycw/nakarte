# Слои карты: что добавить бесплатно

Ресёрч 2026-10-11 по просьбе владельца: какие слои ещё можно добавить и можно ли бесплатно использовать mapy.cz. Источники — официальные условия и цены сервисов (ссылки у каждого факта), CORS проверен `curl` с `Origin: https://nakarte-routing.pages.dev`. Решения владельца помечены **[владелец]**. Каждый change переносит свои решения в свой design; этот документ остаётся справкой.

## Решения владельца 2026-10-11

- Делаем: спутник EOX Sentinel-2 cloudless, затем ресёрч снимков по датам, затем горизонтали из рельефа (таблица [changes](#changes-по-порядку)) **[владелец]**.
- Не делаем: слои Mapy.com и OpenSnowMap **[владелец]**.
- Thunderforest (`Oso`, `Ocm`) оставить как есть, хотя без ключа на тайлах водяной знак «API Key Required» **[владелец]**.

## Mapy.com (Seznam)

- Официальный REST API тайлов: наборы `basic`, `outdoor`, `winter`, `aerial` и прозрачный `names-overlay`, тайл 256 px, retina 512 px — только у `basic` и `outdoor`, `aerial` по миру до z13 ([тайлы](https://developer.mapy.com/rest-api/funkce/mapove-dlazdice/)). Есть ли разметка троп в `outdoor` API — не проверено.
- Нужен свой ключ; бесплатно 250 000 кредитов в месяц, тайл — 1 кредит, после исчерпания без платного потребления сервис стоит до конца месяца; дальше 1,60 CZK за 1000 кредитов ([цены](https://developer.mapy.com/pricing/), [условия](https://developer.mapy.com/terms-and-conditions/), п. 2.1). Тариф с 10 млн кредитов не подходит: данные Mapy нельзя смешивать с другими картами.
- Ключ ограничивается по Referer, IP, User-Agent ([защита ключа](https://developer.mapy.com/en/my-account/api-key-security)); `api.mapy.com` отражает `Origin` — прокси не нужен. Кешировать тайлы и ответы запрещено (условия, п. 4.6.2).
- Атрибуция: кликабельный логотип Mapy.com поверх карты (не меньше 30 px) и текст со ссылкой ([атрибуция](https://developer.mapy.com/rest-api-mapy-cz/atribution/)).
- Поиск приложения (`web/src/search/mapycz.ts`) ходит на `pro.mapy.cz/suggest/` — недокументированную ручку сайта без ключа. Условия разрешают сервис только через функции developer.mapy.com (п. 3.1) и запрещают скрейпинг (п. 4.6.2): риск, ручка может сломаться. У REST API есть автодополнение, 4 кредита за вызов ([цены](https://developer.mapy.com/pricing/)). Владелец не решал.

## Кандидаты

| Слой | Что | Ключ, лимит | Условия | CORS | В каталоге |
|---|---|---|---|---|---|
| EOX Sentinel-2 cloudless | спутник 10 м без облаков, мозаики по годам | нет | CC BY-NC-SA 4.0 — только некоммерческое, подпись с годом ([лицензия](https://cloudless.eox.at/documentation/license), [слои WMTS](https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml)) | отражает `Origin` | нет |
| Горизонтали (`maplibre-contour`) | изолинии из DEM в браузере | нет | BSD-3, работает с Terrarium ([репозиторий](https://github.com/onthegomap/maplibre-contour)) | — | нет, есть отмывка `Hs` |
| Thunderforest Outdoors, OpenCycleMap | туризм, вело | ключ; Hobby — 150 тыс. тайлов в месяц ([цены](https://www.thunderforest.com/pricing/)) | кеширующие прокси запрещены ([условия](https://www.thunderforest.com/terms/)) | `*` | `Oso`, `Ocm` без ключа, с водяным знаком |
| OpenTopoMap | топо | нет | CC-BY-SA, без массовых загрузок ([о проекте](https://opentopomap.org/about)) | `*` | `Otm` |
| CyclOSM | вело | нет | fair use OSM-France ([сайт](https://www.cyclosm.org/)) | `*` | `Co` |
| OpenSnowMap | горнолыжные трассы | нет | CC-BY-SA, без массовых загрузок ([данные](https://www.opensnowmap.org/iframes/data.html)) | `*` | нет |
| MapTiler Outdoor, Satellite | туризм, спутник | ключ; 5 тыс. сессий / 100 тыс. запросов, потом стоп до месяца ([цены](https://www.maptiler.com/cloud/pricing/)) | некоммерческое | `*` | нет |
| Stadia | Stamen Terrain и др. | 200 тыс. кредитов ([цены](https://stadiamaps.com/pricing/)) | коммерческое запрещено, спутника на бесплатном нет | `*` | нет |
| Esri World Imagery | спутник | официально — ключ ArcGIS, 2 млн тайлов ([цены](https://location.arcgis.com/pricing/)) | Esri Master License; доступ без ключа — не проверено | `*` | `E` без ключа |

## Риски уже подключённого (владелец не решал)

- Google (`G`, `Gh`, `L`, `P`) — прямые тайлы `mt*.google.com` без лицензии Maps Platform; условия запрещают скрейпинг, кеш и показ Street View рядом с не-Google картой ([условия](https://cloud.google.com/maps-platform/terms), «No Use With Non-Google Maps»). Последнее касается и функции Street View.
- Bing (`I`, `Gbt`) — без ключа; бесплатные Basic-аккаунты Bing Maps for Enterprise работали до 30.06.2025 ([лицензии](https://microsoft.com/en-us/maps/bing-maps/licensing/bing-maps-for-enterprise)).
- Tracestrack — бесплатный тариф только некоммерческий ([условия](https://www.tracestrack.com/en/terms)).

## Changes по порядку

| # | Change | Что | Решения |
|---|---|---|---|
| 1 | `add-sentinel-imagery` | подложка EOX Sentinel-2 cloudless (свежая годовая мозаика) в каталоге, подпись с годом | владелец 2026-10-11 |
| 2 | ресёрч снимков по датам | не change, а ресёрч `openspec/research/` по пункту backlog «Спутниковый слой с выбором даты»: можно ли смотреть снимки Sentinel-2 за конкретную дату на маршруте, «делать или нет» и план changes. Мозаика cloudless (№ 1) дат не даёт — это годовой композит | владелец 2026-10-11 |
| 3 | `add-contour-lines` | оверлей горизонталей `maplibre-contour` на рельефе Terrarium, который уже даёт отмывку `Hs` | владелец 2026-10-11 |
