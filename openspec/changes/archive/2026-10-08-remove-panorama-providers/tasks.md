# Tasks

## 1. Удаление провайдеров

- [x] 1.1 Удалить `lib/wikimedia`, `lib/mapillary`, `lib/mapycz` и их записи в `getProviders()`, ключи `wikimediaCommonsCoverageUrl`, `mapillaryRasterTilesUrl`, `mapillary4`, зависимость `mapillary-js` и её исключения в webpack; проверка: `grep -rn "mapillary\|wikimedia" src webpack package.json yarn.lock` пусто, сборка клона проходит
- [x] 1.2 Удалить `src/config-target/exclude-panoramas.js`, `test/test_exclude_panoramas.js`, `excludedPanoramaProviders`, вернуть строку конструктора в `src/App.js`; проверка: линт `NODE_ENV=production npx eslint --ext js .`, `main.yml` зелёный на PR
- [x] 1.3 Старые ссылки: `n2=wmc` и `n2=_wmc/c/<lat>/<lng>/...` открывают карту без ошибок; проверка: в браузере на локальном клоне (8766), в списке панорам только «Google street view»

## 2. Ключ Google

- [x] 2.1 Шаг в `.github/workflows/deploy-pages.yml`: секрет `GOOGLE_MAPS_API_KEY` подставляется в `src/secrets.js`, без секрета — заглушка; проверка: деплой без секрета зелёный, в бандле прода заглушка

## 3. Документы

- [x] 3.1 Бэклог (без ресёрча покрытий, mapy.cz — отдельным слоем, инструкция ключа Google), `own-backends.md`, `drop-author-services`, `AGENTS.md`; проверка: `openspec validate --all --strict`

## 4. Прод

- [x] 4.1 На `https://nakarte-routing.pages.dev`: в списке панорам только Google street view, запросов к `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` и `proxy.nakarte.me/mapy/` нет

## Workflow follow-up

- Архивировать: `openspec archive remove-panorama-providers --yes`.
