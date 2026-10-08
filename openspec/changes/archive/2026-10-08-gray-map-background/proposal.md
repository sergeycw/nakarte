# Proposal

## Why

При смене подложки новое приложение держит прежнюю подложку под новой до события `idle` ([add-web-map-layers](../2026-10-08-add-web-map-layers/design.md), коммит «keep the old base layer until the new one has loaded»). Владелец решил иначе (2026-10-08): как в старом клиенте — подложка меняется сразу, а пока тайлы грузятся, под ними серый фон, а не белый.

## What Changes

- Под всеми слоями карты — фон `#ddd`, как у `.leaflet-container` в `leaflet.css` старого клиента.
- Удержание прежней подложки до `idle` убирается: смена подложки сразу убирает старый слой.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-client`: серый фон карты под слоями, пока тайлы грузятся или меняются.

## Impact

- `web/src/layers/style.ts`, `web/src/map/BaseMap.tsx`, тесты `web/`.
- Старый клиент, Worker'ы и деплой не меняются.
