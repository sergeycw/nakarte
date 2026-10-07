# Proposal

## Why

17 слоёв сканов карт раздаются с тайлов автора (`{s}.tiles.nakarte.me`, `tiles.nakarte.me/topomapper`). Исходных растров у клона нет, а зависимость от тайлов автора противоречит цели полной автономии. Решение владельца — убрать эти слои из клона (`openspec/research/own-backends.md`).

## What Changes

- Список кодов исключённых слоёв в `src/config-target/clone.js`: T, D, N, A, J, C, F, B, K, U, R, E25m, NT1, NT5, T25, MN25, Pur.
- Фильтр при сборке списка слоёв: исключённые слои не попадают в выбор слоёв, хоткеи, печать и восстановление из адреса. `src/layers.js` не правится, чтобы дифф с апстримом остался маленьким.
- Тест karma на фильтр без сети.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: клон не показывает слои сканов карт автора.

## Impact

- Изменения: `src/config-target/clone.js`, `src/config-target/default.js` (пустой список), место сборки слоёв (`getLayers` или его вызов в `src/App.js`), новый тест в `test/`.
- Сборка без цели (апстрим) ведёт себя как раньше.
