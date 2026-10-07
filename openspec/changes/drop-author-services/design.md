# Design

## Context

Мотивация — в `proposal.md`. Адреса `https://proxy.nakarte.me/mapy/…` захардкожены в `src/layers.js` (слои «mapy.cz tourist (Out of order)», «mapy.cz winter (Out of order)») и в `src/lib/leaflet.control.panoramas/lib/mapycz/index.js` (покрытие панорам, в клоне скрыто `hide-panorama-providers`, запросов нет); в апстриме слои помечены «Out of order». Свой прокси (`workers/cors-proxy`, спека `cors-proxy`) уже знает алиас `/wikimapia/`. Подпись карты — `caption` в `src/config.js`. В коде остаются строки `nakarte.me`, которые не являются запросами: `creator="http://nakarte.me"` в GPX и `<title>` страницы — их не трогаем.

## Goals / Non-Goals

**Goals:**
- Ни одного сетевого запроса к `*.nakarte.me` из клона.

**Non-Goals:**
- Переименование клона и смена метаданных в экспортируемых файлах.

## Decisions

### Адреса mapy.cz из config

Захардкоженный префикс `https://proxy.nakarte.me/mapy/` выносится в ключ конфига (например, `mapyTilesBaseUrl`) со значением автора по умолчанию и своим прокси в `clone.js` — тем же приёмом, что `wikimapiaTilesBaseUrl`. Прокси получает алиас `/mapy/<слой>/` → эндпоинт mapy.cz с ключом из `wrangler secret`. Какие именно эндпоинты и условия у mapy.cz — первая задача; если раздача через прокси не разрешена, слои mapy.cz скрываются фильтром из `drop-author-scan-layers`, а дельта `cors-proxy` убирается из этого change.

### Сквозная проверка как тест

Требование «без запросов к `*.nakarte.me`» проверяется в браузере по журналу сети и статически: поиск адресов `nakarte.me` в собранном бандле клона, исключая известные метаданные (GPX `creator`, `<title>`). Статическая проверка — скрипт в CI клона.

## Risks / Trade-offs

- [Условия mapy.cz запрещают проксирование] → скрыть слои в клоне.
- [Новые адреса автора появятся при ребейзе на апстрим] → статическая проверка бандла в CI ловит их.
