# Proposal

## Why

`hide-panorama-providers` прятал панорамы Wikimedia Commons, Mapillary и mapy.cz только в клоне, а их код, зависимость `mapillary-js` и фильтр в `config-target` оставались в проекте. Решение владельца 2026-10-08: эти провайдеры в работу не брать и удалить как лишний код; mapy.cz как отдельный слой карты — пункт в бэклоге. Заодно окно Google Street View, единственного провайдера, должно заработать в клоне, как только владелец заведёт ключ.

## What Changes

- Удалены провайдеры `src/lib/leaflet.control.panoramas/lib/wikimedia`, `lib/mapillary`, `lib/mapycz` и их записи в `getProviders()`; в панорамах остаётся только Google Street View во всех сборках.
- Удалены ключи `wikimediaCommonsCoverageUrl`, `mapillaryRasterTilesUrl` (`src/config.js`) и `mapillary4` (`src/secrets.js.template`), зависимость `mapillary-js` и исключения для неё в `webpack/webpack.config.js`.
- Удалены фильтр `src/config-target/exclude-panoramas.js`, его тест и `excludedPanoramaProviders`; `src/App.js` в этом месте снова как в апстриме.
- Деплой подставляет ключ Google из секрета GitHub `GOOGLE_MAPS_API_KEY`, если он заведён; без секрета остаётся заглушка шаблона.
- Ресёрч покрытий Wikimedia Commons и Mapillary убран из бэклога; mapy.cz — пункт про отдельный слой.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: требование «Панорамы клона» заменено на «Только Google Street View в панорамах» — других провайдеров в коде нет.
- `clone-deploy`: «Сборка из шаблона секретов» — ключ Google из секрета GitHub.

## Impact

- Удаления в апстримных файлах: `src/lib/leaflet.control.panoramas/`, `src/config.js`, `src/secrets.js.template`, `package.json`, `yarn.lock`, `webpack/webpack.config.js` — дифф с апстримом растёт, ребейз на этих файлах даст конфликты «изменено у них, удалено у нас».
- `.github/workflows/deploy-pages.yml`, `src/App.js`, `src/config-target/clone.js`.
- Владелец: ключ Maps JavaScript API и секрет `GOOGLE_MAPS_API_KEY`.
