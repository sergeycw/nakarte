# Proposal

## Why

Высота и уклон под курсором (`L.Control.Coordinates`, слой `leaflet.layer.elevation-display`) читаются из тайлов `tiles.nakarte.me/elevation` автора. Для автономии клону нужны свои тайлы в том же формате, построенные из тех же данных DEM 3″ viewfinderpanoramas, что и сервис высот (`add-elevation-api`).

## What Changes

- Генератор тайлов z0–11 в формате клиента (Int16 с дельта-кодированием, 256×256, nodata `-512`) из перепакованных кусков DEM 3″, результат — один архив PMTiles.
- Раздача тайлов по `/{z}/{x}/{y}` из архива в R2 тем же Worker сервиса высот или отдельным маршрутом, с gzip и кешированием.
- Тесты генератора и раздачи без сети, в workflow `check-elevation.yml`.
- `elevationTileUrl` в `src/config-target/clone.js` на свой адрес.

## Capabilities

### New Capabilities

- `elevation-tiles`: растровые тайлы высот для отображения высоты и уклона под курсором — формат тела, диапазон зумов, отсутствие данных, CORS и кеширование.

### Modified Capabilities

- `clone-hosting`: клон берёт тайлы высот у себя, а не с `tiles.nakarte.me`.

## Impact

- Код: крейт генератора в `workers/elevation/`, маршрут тайлов в Worker, фикстуры.
- Данные: архив PMTiles в R2; генерация вне CI.
- Изменения: `src/config-target/clone.js`.
- Зависимость: нужны перепакованные данные и ядро из `add-elevation-api`.
