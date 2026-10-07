# Design

## Context

Мотивация — в `proposal.md`. Слои описаны в `src/layers.js` (`layersDefs`, `groupsDefs`, `titlesByOrder`); `getLayers()` раскладывает их по группам и передаётся в `enableLayersConfig` в `src/App.js`. Коды слоёв участвуют в адресе (`l=…`) и в хоткеях. `test/test_layers.js` проверяет определения слоёв.

## Goals / Non-Goals

**Goals:**
- Убрать 17 слоёв только в клоне, без правки `src/layers.js`.

**Non-Goals:**
- Удаление слоёв из апстримной сборки.
- Замена слоёв другими.

## Decisions

### Фильтр из `hide-map-data-layers`

Механизм уже есть: `excludedLayerCodes` в `src/config-target/clone.js` и `excludeLayers()` из `src/config-target/exclude-layers.js` на входе `enableLayersConfig` в `src/App.js`. Восстановление из адреса с кодом скрытого слоя проверено там же (`l=O/Wp`). Этот change только дописывает 17 кодов и проверяет, что у сканов нет путей мимо `getLayers()`.

## Risks / Trade-offs

- [Слой участвует в другом коде (печать, экспорт, группы по умолчанию)] → поиск по кодам и названиям перед правкой; тест на каждый путь, где нашлись ссылки.
