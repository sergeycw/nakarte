# Tasks

## 1. Удаление слоёв

- [x] 1.1 Найти все места, где используются коды или названия 19 слоёв (выбор слоёв, хоткеи, печать, JNX, адрес, группы по умолчанию, тесты); проверка: список мест записан в `design.md`
- [x] 1.2 Удалить 17 слоёв сканов, `Wp` и `Gc` из `layersDefs`, `groupsDefs`, `titlesByOrder`; код слоёв перевалов и геокешинга, `rasterize/WestraPasses.js`, `geojson-ajax`, ключи `westraDataBaseUrl` и `geocachingSuUrl`; проверка: тест karma `test/test_removed_layers.js` — удалённых кодов и тайлов `tiles.nakarte.me` нет, `test/test_layers.js` зелёный (оба запускает `main.yml`)
- [x] 1.3 Удалить фильтр `excludedLayerCodes`: `src/config-target/exclude-layers.js`, вызов в `src/App.js`, `test/test_exclude_layers.js`, ключ в `clone.js`; проверка: `grep -rn "excludeLayers\|excludedLayerCodes" src test` пусто, линт зелёный
- [x] 1.4 Код удалённого слоя в адресе и в `leafletLayersSettings` не ломает загрузку; проверка: тест karma в `test/test_removed_layers.js` (контрол слоёв без сети) и в браузере на локальном клоне (8766) с `l=O/F`, `l=O/Wp`, `l=F` и старыми настройками в `localStorage`

## 2. Проверка

- [x] 2.1 Линт `NODE_ENV=production npx eslint --ext js .` (и без `node_modules` сервисов), `openspec validate --all --strict`, тесты из 1.2 зелёные в `main.yml`
- [x] 2.2 В браузере на локальном клоне (8766) и сборке без цели (8770): в выборе слоёв нет удалённых слоёв, запросов к `tiles.nakarte.me` и `nakarte.me/westraPasses|geocachingSu` нет
- [x] 2.3 Обновить `openspec/research/own-backends.md`, `openspec/backlog.md`, `AGENTS.md`; проверка: нет упоминаний скрытых в клоне слоёв и `excludedLayerCodes`

## 3. Прод

- [x] 3.1 На `https://nakarte-routing.pages.dev`: в выборе слоёв нет удалённых слоёв, `l=O/F` открывает OpenStreetMap; проверка: запросов к `tiles.nakarte.me` нет

## Workflow follow-up

- Архивировать: `openspec archive drop-author-scan-layers --yes`.
