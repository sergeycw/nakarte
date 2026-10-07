# Proposal

## Why

После своих сервисов треков и высот и скрытых слоёв и панорам у клона остаются последние обращения к инфраструктуре автора: слои mapy.cz через `proxy.nakarte.me/mapy/…` (захардкожено в `src/layers.js`; панорама mapy.cz в клоне скрыта `hide-panorama-providers`) и ссылки в подписи карты на docs, news, donate и почту автора. Этот change закрывает автономию и фиксирует её проверяемым требованием. Делается последним, после остальных changes из `openspec/research/own-backends.md`.

## What Changes

- Тайлы mapy.cz (туристическая и зимняя карты) идут через свой прокси `nakarte-cors-proxy` с ключом mapy.cz в секретах Worker; если условия mapy.cz этого не позволяют — слои mapy.cz скрываются в клоне тем же механизмом, что слои сканов.
- Подпись карты клона (`caption`) — свои ссылки: репозиторий форка вместо docs, news, donate и почты автора.
- Требование и проверка: клон не делает ни одного сетевого запроса к `*.nakarte.me`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: требование «Сборка под клон» дополняется прокси mapy.cz и своей подписью карты; новое требование — без запросов к `*.nakarte.me`.
- `cors-proxy`: требование «Формат адреса» дополняется маршрутом `/mapy/` для тайлов mapy.cz.

## Impact

- Изменения: `src/config-target/clone.js`, `src/config.js` или место подстановки адресов mapy.cz, `workers/cors-proxy/src/index.js` и его секреты, `openspec/specs/cors-proxy`.
- Внешнее: ключ API mapy.cz заводит владелец.
- Зависимость: архивировать после `add-track-storage`, `add-elevation-api`, `add-elevation-tiles`, `hide-map-data-layers`, `hide-panorama-providers`, `drop-author-scan-layers` — иначе требование «без запросов к `*.nakarte.me`» не выполняется.
