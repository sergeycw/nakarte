# Proposal

## Why

17 слоёв сканов карт раздаются с тайлов автора (`{s}.tiles.nakarte.me`, `tiles.nakarte.me/topomapper`). Исходных растров у клона нет, а зависимость от тайлов автора противоречит цели полной автономии. Решение владельца — убрать эти слои из клона (`openspec/research/own-backends.md`).

## What Changes

- Коды 17 слоёв дописываются в `excludedLayerCodes` в `src/config-target/clone.js`: T, D, N, A, J, C, F, B, K, U, R, E25m, NT1, NT5, T25, MN25, Pur. Сам фильтр (`src/config-target/exclude-layers.js`, вызов в `src/App.js`) и требование «Скрытые слои клона» уже сделаны change `hide-map-data-layers`.
- Тест karma: в клоне 17 слоёв скрыты.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: клон не показывает слои сканов карт автора.

## Impact

- Изменения: `src/config-target/clone.js`, тест в `test/test_exclude_layers.js`.
- Сборка без цели (апстрим) ведёт себя как раньше.
