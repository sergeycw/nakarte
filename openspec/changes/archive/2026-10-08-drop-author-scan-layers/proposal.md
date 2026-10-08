# Proposal

## Why

17 слоёв сканов карт раздаются с тайлов автора (`{s}.tiles.nakarte.me`, `tiles.nakarte.me/topomapper`), а слои перевалов Вестры (`Wp`) и geocaching.su (`Gc`) берут данные с `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/`. Исходных данных у клона нет, а зависимость от автора противоречит цели полной автономии. Решение владельца 2026-10-08: строим свой продукт, в апстрим не мерджимся (`AGENTS.md`, «Апстрим»), поэтому слои удаляются из кода во всех сборках, а не прячутся фильтром в клоне.

## What Changes

- Из `src/layers.js` удалены 17 слоёв сканов (коды T, D, N, A, J, C, F, B, K, U, R, E25m, NT1, NT5, T25, MN25, Pur) и слои `Wp` и `Gc` вместе с их записями в `groupsDefs` и `titlesByOrder`.
- Удалён код слоёв перевалов и геокешинга: `src/lib/leaflet.layer.westraPasses`, `src/lib/leaflet.layer.geocaching-su`, растеризация для печати `src/lib/leaflet.layer.rasterize/WestraPasses.js`, ставший ненужным `src/lib/leaflet.layer.geojson-ajax`, ключи `westraDataBaseUrl` и `geocachingSuUrl` в `src/config.js`.
- `excludedLayerCodes` пуст, поэтому фильтр `hide-map-data-layers` удалён целиком: `src/config-target/exclude-layers.js`, его вызов в `src/App.js`, `test/test_exclude_layers.js`, ключ в `src/config-target/clone.js`.
- Тест karma: удалённых слоёв нет, тайлов `tiles.nakarte.me` нет; код удалённого слоя в адресе и в сохранённых настройках слоёв не ломает загрузку.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: требования «Скрытые слои клона» и «Без слоёв данных автора» заменены требованиями «Без слоёв на данных автора» (слоёв нет в коде ни одной сборки) и «Старые коды удалённых слоёв».

## Impact

- Удаления в апстримных файлах: `src/layers.js`, `src/config.js`, `src/App.js`, `src/lib/leaflet.layer.rasterize/index.js`, каталоги слоёв. Перенос правок автора в удалённые файлы — конфликт modify/delete, решать удалением.
- Пользователи сборки без цели тоже теряют эти слои: локальный серверный режим и клон теперь одинаковы по набору слоёв.
- Свои данные перевалов и геокешинга остаются пунктом бэклога; код слоёв при надобности возвращается из истории git или из `upstream/master`.
