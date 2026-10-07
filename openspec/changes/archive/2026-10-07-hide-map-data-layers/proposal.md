# Proposal

## Why

Слои «Mountain passes (Westra)» (`Wp`) и «geocaching.su» (`Gc`) берут данные с `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/`. Своих данных у клона нет: полный JSON API Вестры требует ключа, а условия geocaching.su запрещают воспроизводить материалы сайта без согласия администрации (ресёрч 2026-10-07 — в `openspec/backlog.md`). Решение владельца — скрыть оба слоя в клоне, а свои сборщики данных отложить в бэклог с низким приоритетом.

## What Changes

- Список `excludedLayerCodes` в `src/config-target/clone.js` (`Wp`, `Gc`), в `default.js` списка нет.
- Фильтр результата `getLayers()` перед `enableLayersConfig` в `src/App.js`: исключённые слои не попадают в выбор слоёв, хоткеи, печать и восстановление из адреса. `src/layers.js` не правится.
- Тест karma на фильтр без сети.
- Change `add-map-data-scrapers` удалён, итоги его ресёрча — в бэклоге; `drop-author-scan-layers` переиспользует этот фильтр.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: клон не показывает слои с данными автора `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/`; появляется механизм скрытия слоёв по коду.

## Impact

- Изменения: `src/App.js` (вызов фильтра), `src/config-target/clone.js`, новый `src/config-target/exclude-layers.js`, новый тест `test/test_exclude_layers.js`.
- Сборка без цели (апстрим) ведёт себя как раньше.
