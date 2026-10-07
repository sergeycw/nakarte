# Tasks

## 1. Фильтр провайдеров

- [x] 1.1 `excludePanoramaProviders` в `src/config-target/exclude-panoramas.js`, `excludedPanoramaProviders: ['wikimedia', 'mapillary', 'mapycz']` в `src/config-target/clone.js`, вызов в `src/App.js`; проверка: тест karma `test/test_exclude_panoramas.js` — базовый контрол отдаёт четыре провайдера, клон — только `google`, без списка класс не меняется
- [x] 1.2 Адрес со скрытым провайдером: карта открывается без ошибок; проверка: в браузере на локальном клоне (8766) `n2=wmc` и `n2=_c/c/<lat>/<lng>/...` не включают скрытых провайдеров, ошибок в консоли нет

## 2. Проверка

- [ ] 2.1 Линт и тесты: `NODE_ENV=production npx eslint --ext js .`, тест из 1.1 зелёный в `main.yml`
- [x] 2.2 В браузере на локальном клоне: в списке панорам только «Google street view», запросов к `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` и `proxy.nakarte.me/mapy/` нет
- [x] 2.3 Удалить change `add-photo-coverage-tiles`, итоги ресёрча — в `openspec/backlog.md`, статус пункта 5 в `openspec/research/own-backends.md`, панорамы mapy.cz в `drop-author-services` — на этот фильтр; проверка: `openspec validate --all --strict`

## 3. Прод

- [ ] 3.1 На `https://nakarte-routing.pages.dev`: в списке панорам только Google street view; проверка: запросов к `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` и `proxy.nakarte.me/mapy/` нет

## Workflow follow-up

- Архивировать: `openspec archive hide-panorama-providers --yes`.
