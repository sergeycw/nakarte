# Tasks

## 1. Фильтр слоёв

- [x] 1.1 `excludeLayers` в `src/config-target/exclude-layers.js`, `excludedLayerCodes: ['Wp', 'Gc']` в `src/config-target/clone.js`, вызов в `src/App.js` перед `enableLayersConfig`; проверка: тест karma `test/test_exclude_layers.js` — с непустым списком слоёв из списка нет в группах, пустые группы убраны, без списка вход не меняется
- [x] 1.2 Адрес с кодом скрытого слоя: карта открывается без ошибок; проверка: в браузере на локальном клоне (8766) `l=O/Wp` открывает OpenStreetMap, `l=Wp` — слой по умолчанию, ошибок в консоли нет

## 2. Проверка

- [x] 2.1 Линт и тесты: `NODE_ENV=production npx eslint --ext js .`, тест из 1.1 зелёный в `main.yml`
- [x] 2.2 В браузере на локальном клоне: в выборе слоёв нет «Mountain passes (Westra)» и «geocaching.su», запросов к `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/` нет; на сборке без цели (8765) оба слоя на месте
- [x] 2.3 Удалить change `add-map-data-scrapers`, итоги ресёрча — в `openspec/backlog.md`, статус пункта 4 в `openspec/research/own-backends.md`, `drop-author-scan-layers` и `drop-author-services` — на этот фильтр и без зависимости от скраперов; проверка: `openspec validate --all --strict`

## 3. Прод

- [x] 3.1 На `https://nakarte-routing.pages.dev`: в выборе слоёв нет обоих слоёв; проверка: запросов к `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/` нет

## Workflow follow-up

- Архивировать: `openspec archive hide-map-data-layers --yes`.
