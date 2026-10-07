# Design

## Context

Мотивация — в `proposal.md`. Клиент:
- Wikimedia: `src/lib/leaflet.control.panoramas/lib/wikimedia/` — `MultiLayer` из `L.tileLayer` с `tms: true` для z0–10 и `WikimediaVectorCoverage` для z11+, который берёт данные z11 (`Uint16Array`, пары `x, y`, `dataOffset = 5000`, `dataExtent = 65535 − 2·5000`) и рисует круги; `404` — нет данных.
- Mapillary: `src/lib/leaflet.control.panoramas/lib/mapillary/` — `L.tileLayer` с `tileSize: 1024`, `zoomOffset: -2`; поиск снимков идёт напрямую в `graph.mapillary.com` с токеном `config.mapillary4`.
- Тайлы автора 2026-10-07: Wikimedia z5 — `image/png`; z11 отдаётся с `image/png`, хотя тело — бинарные пары.

## Goals / Non-Goals

**Goals:**
- Те же форматы и адреса без правок клиента.
- Обновление без ручной работы.

**Non-Goals:**
- Новый вид отображения покрытия.
- Замена поиска снимков (он уже идёт в API Wikimedia и Mapillary напрямую).

## Decisions

### Источник Wikimedia Commons

Варианты: дамп геотегов (таблица `geo_tags` из дампов Wikimedia Commons) или обход API `generator=geosearch`. Дамп даёт весь мир одним файлом и не нагружает API; выбор и ссылки фиксируются первой задачей. Фильтры качества — как в `parseSearchResponse` клиента: только JPG, без «искусственных» координат.

### Источник Mapillary

Покрытие Mapillary берётся из официального API v4 (векторные тайлы покрытия или выгрузка), с токеном, который владелец кладёт в секреты Worker или CI. Точный эндпоинт и условия использования фиксируются первой задачей; без токена change останавливается.

### Генерация офлайн, раздача из R2

Генерация — периодическая задача (Cron Trigger или GitHub Actions, в зависимости от объёма и длительности), результат — архивы PMTiles или объекты в R2; раздаёт Worker с CORS и кешем. Выбор фиксируется после оценки объёма.

## Risks / Trade-offs

- [Объём покрытия Mapillary на детальных зумах] → генерировать до зума, который реально запрашивает клиент (`zoomOffset: -2`), остальное масштабирует Leaflet.
- [Условия использования API Mapillary] → проверка первой задачей.
- [Тело z11 Wikimedia с `Content-Type: image/png` у автора] → клиент читает `arraybuffer` и на тип не смотрит; отдаём `application/octet-stream`.

## Migration Plan

Генерация → раздача → переключение ключей в `config-target/clone.js`. Откат — вернуть URL автора.

## Open Questions

- Объём тайлов покрытия и частота обновления Mapillary — после первой генерации.
