# Design

## Context

Мотивация — в `proposal.md`. Контрол панорам (`src/lib/leaflet.control.panoramas/index.js`) после `hide-panorama-providers` получал полный список провайдеров и фильтровал его наследником из `src/config-target/exclude-panoramas.js`. Провайдеры подключаются статическими импортами в `index.js`, `mapillary-js` — динамическим `import()` внутри `lib/mapillary`; ради неё в `webpack/webpack.config.js` исключения из карт исходников и из Terser. `config.mapyCzKey`, который читал провайдер mapy.cz, в `src/config.js` не задан. Ключ Google нужен только окну Street View (`src/lib/googleMapsApi` используется лишь провайдером `google`); покрытие — тайлы без ключа.

## Goals / Non-Goals

**Goals:**
- Убрать код, зависимость и конфиг провайдеров, которые не будут использоваться.
- Ключ Google без правки кода: только секрет GitHub.

**Non-Goals:**
- Слои mapy.cz (`src/layers.js`), поиск mapy.cz и ссылка на mapy.cz во внешних картах — остаются; слой mapy.cz — пункт в бэклоге, прокси — `drop-author-services`.
- Свой провайдер вместо удалённых (Яндекс Панорамы — ресёрч в бэклоге).

## Decisions

### Удалить, а не прятать

Владелец решил, что провайдеры не вернутся, поэтому прятать их в `config-target` незачем: удаляются каталоги провайдеров, их записи в `getProviders()`, ключи конфига, секрет `mapillary4`, `mapillary-js` (`yarn remove`, из `yarn.lock` ушли ещё ≈ 30 пакетов, тянувшихся только ею) и её исключения в webpack. Фильтр `exclude-panoramas.js` теряет смысл и удаляется вместе с тестом; `src/App.js` в строке конструктора возвращается к апстриму. Цена — дифф с апстримом в файлах контрола панорам, `config.js`, шаблона секретов, `package.json` и `yarn.lock`: при ребейзе правки автора в удалённых провайдерах дадут конфликт «modify/delete», он решается повторным удалением.

Коды `w`, `m`, `c` в адресе (`n2=`, старый `n=`) `unserializeState` ищет только среди `this.providers`, поэтому старые ссылки открываются без ошибок и ничего не включают — так же, как при фильтре.

### Ключ Google из секрета

Шаг в `deploy-pages.yml` после копирования шаблона: если секрет `GOOGLE_MAPS_API_KEY` не пуст, `sed` подставляет его в поле `google` в `src/secrets.js`, иначе остаётся заглушка. Ключ Maps JavaScript API всё равно попадает в бандл и виден всем: защита — ограничение ключа по referrer `https://nakarte-routing.pages.dev` и по API (только Maps JavaScript API), как рекомендует [Google](https://developers.google.com/maps/api-security-best-practices). Цена по [прайсу](https://developers.google.com/maps/billing-and-pricing/pricing): Dynamic Street View — 5 000 бесплатных панорам в месяц, дальше $14 за 1 000 ([тарифицируется за панораму](https://developers.google.com/maps/documentation/javascript/usage-and-billing)).

## Risks / Trade-offs

- [Ребейз на апстрим] → конфликты modify/delete в удалённых провайдерах; решать удалением.
- [Ключ Google в публичном бандле] → ограничения по referrer и API, бюджетные оповещения в Google Cloud.

## Migration Plan

Merge → автодеплой. Окно Street View заработает после того, как владелец заведёт секрет и перезапустит `deploy pages`. Откат — revert PR.
