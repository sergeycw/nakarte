# Proposal

## Why

Подложка по умолчанию — Tracestrack Topo с бесплатной квотой 100 тыс. тайлов в месяц: по замерам 2026-10-30 это ≈ 900 активных заходов с десктопа, дальше откат на OpenStreetMap, который правила OSMF не разрешают нагружать приложением ([load-capacity.md](../../research/load-capacity.md)). У публичного OpenFreeMap лимитов на запросы нет, векторная подложка «OpenFreeMap Outdoor» (`Of`) уже в каталоге. Владелец 2026-10-30 решил сделать её подложкой по умолчанию, а при её сбое откатываться на Tracestrack Topo.

## What Changes

- Подложка по умолчанию — «OpenFreeMap Outdoor» (`Of`) вместо «Tracestrack Topo» (`Tt`). `l=` и сохранённый выбор по-прежнему важнее: у тех, кто уже заходил, остаётся сохранённая подложка.
- Откат подложки при ошибке тайлов — цепочкой `Of` → `Tt` → `O`: сбой OpenFreeMap показывает Tracestrack Topo, сбой Tracestrack — OpenStreetMap. Откат по-прежнему не меняет выбор в `l=` и в сохранённом выборе. Разовый сбой сети у уже показанной подложки и сеть, пропавшая в браузере, отката не дают.
- Круг «топокарта» справа — OpenFreeMap Outdoor: первый слой группы `Topo layers` — `Of`, картинка превью — `Of`, Tracestrack Topo переходит в меню группы и в настройку списка слоёв.
- Квота Tracestrack тратится только у тех, кто выбрал её сам, и во время сбоя OpenFreeMap.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `map-layers`: «Подложка по умолчанию» (OpenFreeMap Outdoor), откат подложки — цепочкой (требование переименовано из «Откат подложки Tracestrack на OpenStreetMap»), «Превью подложек справа» (круг топокарты — OpenFreeMap Outdoor), сценарии «Список слоёв» и «Кнопок столбца в настройке нет».
- `web-client`: «Полноэкранная карта» (первый заход показывает OpenFreeMap Outdoor) и «Тост при ошибке тайлов» (откат вместо тоста у обеих подложек цепочки).

## Impact

- `web/src/layers/selection.ts` (подложка по умолчанию и цепочка отката), `web/src/state/store.ts` (`fallBackBase`, `savedSelection`), `web/src/App.tsx` (тост отката), `web/src/layers/quick-layers.ts` (порядок группы), `web/src/layers/thumbnails/` и `scripts/layer-thumbnails.mjs` (превью `Of` вместо `Tt`).
- Тесты: unit (`store`, `sync`, `selection`, `quick-layers`, `catalog`), browser (`App`, `LayerSwitcher`), e2e (`map-layers`, `web-client`, `browser-routing-engine`) — всё, что ждёт `Tt` по умолчанию.
- Внешние сервисы: на OpenFreeMap переходит трафик подложки новых пользователей; у OpenFreeMap нет SLA ([условия](https://openfreemap.org/tos/)), отсюда откат на Tracestrack.
- Документы: `AGENTS.md` (подложка по умолчанию и откат), `docs/architecture/` (реестр решений), `openspec/backlog.md`, шапка `openspec/research/load-capacity.md`.
