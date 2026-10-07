# Proposal

## Why

Высота и уклон под курсором (`L.Control.Coordinates`, слой `leaflet.layer.elevation-display`) читаются из тайлов `tiles.nakarte.me/elevation` автора. Для автономии клону нужны свои тайлы в том же формате, построенные из тех же данных DEM 3″ viewfinderpanoramas, что и сервис высот (`add-elevation-api`).

## What Changes

- Тайлы в формате клиента (Int16 с дельта-кодированием, 256×256, nodata `-512`) из перепакованных кусков DEM 3″ с теми же значениями, что у автора: z11 — билинейно, z0–10 — каскадное сглаживание, как `gdalwarp` и `gdaladdo -r gauss` автора.
- Генератор z0–9 в один архив с плотным индексом в R2; z10–11 Worker считает на лету из кусков `dem3`.
- Раздача по `/tiles/{z}/{x}/{y}` тем же Worker сервиса высот, с gzip, `Access-Control-Allow-Origin: *` и кешированием.
- Ручной workflow `elevation tiles` строит архив для всего мира и заливает в R2.
- Тесты генератора и раздачи без сети, в workflow `check-elevation.yml`.
- `elevationTileUrl` в `src/config-target/clone.js` на свой адрес.

## Capabilities

### New Capabilities

- `elevation-tiles`: растровые тайлы высот для отображения высоты и уклона под курсором — формат тела, диапазон зумов, отсутствие данных, CORS и кеширование.

### Modified Capabilities

- `clone-hosting`: клон берёт тайлы высот у себя, а не с `tiles.nakarte.me`.

## Impact

- Код: модуль тайлов в `core`, крейт генератора `tiles` в `workers/elevation/`, маршрут тайлов в `worker` и `server`, фикстуры с тайлами автора.
- Данные: архив z0–9 (≈ 3.5 ГБ) в бакете `nakarte-elevation`; генерация вне CI проверок, ручным workflow.
- Изменения: `src/config-target/clone.js`.
- Зависимость: нужны перепакованные данные и ядро из `add-elevation-api`.
