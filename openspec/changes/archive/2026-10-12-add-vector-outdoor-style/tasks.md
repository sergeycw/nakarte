# Tasks

## 1. Стиль и подписи

- [x] 1.1 `@maplibre/maplibre-gl-style-spec` в `devDependencies` `web/` той же версии, что у MapLibre (`npx --yes npm@11 install`); проверка: `npm ci` и `npm run typecheck` в `web/` зелёные
- [x] 1.2 `web/src/layers/outdoor.ts`: `labelText(language)` и `outdoorLayers(code, language)` по design («Слои стиля», «Подписи в две строки»), только импорты типов; unit `outdoor.test.ts` — «Браузер на русском в Грузии», «Нет перевода на язык браузера», «Название уже на языке браузера», «Вершина с высотой», стиль проходит `validateStyleMin`, нет `glyphs`/`sprite`/`icon-image`; проверка: тест зелёный (CI — `check-web.yml`)

## 2. Каталог и стиль карты

- [x] 2.1 `catalog.ts`: слой `Of` (TileJSON `https://tiles.openfreemap.org/planet`, подпись OpenFreeMap © OpenMapTiles © OpenStreetMap, `labelLanguage` из `env.language`), `ORDER` — `Tt`, `Of`, `O`, `E`, `S2`, `Hls`, `Co`, …; `style.ts` — векторная подложка через `outdoorLayers`; unit `catalog.test.ts` (36 слоёв, порядок, источник, подпись, язык) и `style.test.ts` (`Of` даёт слои стиля, `Ct` — свои); проверка: тесты зелёные
- [x] 2.2 Фикстуры browser-тестов: TileJSON OpenFreeMap и векторный тайл (реальный тайл z12 у Казбека, источник и лицензия — комментарий в `src/test/tiles.ts`) в `src/test/tiles.ts`; browser-тест «Ссылка с OpenFreeMap Outdoor» и «Атрибуция OpenFreeMap» (запросы TileJSON и тайлов, подпись карты, пустой `external`); проверка: `npm test` в `web/` зелёный
- [x] 2.3 Тесты с числом слоёв и составом превью: e2e `map-layers.spec.ts` «Список слоёв» — 36, browser `ImageryDate.browser.test.tsx` — превью Tracestrack Topo, OpenFreeMap Outdoor, OpenStreetMap, ESRI Satellite; новых тестов раскладки нет (решение владельца 2026-10-10, backlog «Интерфейс после макета 4a»): «Превью без запросов тайлов» косвенно — фикстура `network` e2e валит тест на запрос к `tiles.openfreemap.org`; проверка: `npm test` и `npm run build && npm run e2e` в `web/` зелёные

## 3. Превью

- [x] 3.1 `scripts/layer-thumbnails.mjs`: векторная подложка отрисовкой MapLibre по design («Превью `Of.webp`»), шапка скрипта — про векторный путь; `web/src/layers/thumbnails/Of.webp` в сборке; проверка: скрипт с кодом `Of` пишет картинку 72×72, превью видно на скриншоте столбца справа, `npm run lint` в корне зелёный

## 4. Документы и проверка целиком

- [x] 4.1 `AGENTS.md` («Приложение», слои), `docs/architecture/client.md` и `README.md` (связь браузер → OpenFreeMap), `decisions.md` (строка о `Of`), `openspec/backlog.md` (пункт «Новые возможности» — сделана подложка рядом; дальше — умолчание, значки, свой хостинг); проверка: ссылки и якоря изменённых `.md` скриптом
- [x] 4.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/`, `npm run lint` в корне, `openspec validate --all --strict` зелёные
- [x] 4.3 Скриншоты для владельца (headless Playwright против dev-сервера, скрипт вне репозитория): `l=Of` у Казбеги `m=12` и `m=15`, Тбилиси `m=15`, языки `ru-RU` и `en-US`, компьютер и Pixel 7; проверка: подписи в две строки, тропы видны, вершины с высотой

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (перепроверить список), merge.
- После деплоя: `prod check`, `/` с `l=Of` — тайлы OpenFreeMap `200`, подписи у Казбеги и в Тбилиси для `ru` и `en`, вид на компьютере и Pixel 7; итог — абзацем «Прод после add-vector-outdoor-style» в промпт следующей сессии.
