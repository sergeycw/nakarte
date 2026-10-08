# Tasks

## 1. Зависимости и компоненты

- [x] 1.1 `zustand` в `web/package.json` (версия по `npm view zustand version`), lock — `npx --yes npm@11 install`; компоненты shadcn для переключателя и диалогов (`popover`, `dialog`, `checkbox`, `radio-group`, `input`, `label` и что понадобится) через `npx shadcn add`; проверка: `npm run typecheck` и `npx biome ci` зелёные

## 2. Адрес

- [x] 2.1 `web/src/state/hash.ts`: `parseHash`, `formatHash`, `parseView`, `formatView` (зум MapLibre = зум Leaflet − 1, запись +1), неизвестные ключи на своих местах; фикстура реальных ссылок `web/src/state/fixtures/old-links.txt` из issues `wladich/nakarte`; unit-тест `hash.test.ts` на всём наборе (`m=99/…`, неполный `m=`, круговая сборка, сохранение `nktl`, `nktk`, `q`, `r`, `n2`, `p`); проверка: `npm test` зелёный

## 3. Каталог и стиль

- [x] 3.1 `web/src/layers/catalog.ts`: `buildCatalog({pixelRatio, language, corsProxyUrl})` — 30 слоёв старого клиента и `Hs`, группы, порядок наложения, перевод опций Leaflet (design, «Каталог»), прокси для Strava и `Mt`, конечные адреса `Q`, `Z`, `St`, статичные Bing; unit-тест `catalog.test.ts`: набор кодов (нет `Y`, `S`, `W`, `Ng` и слоёв автора), адрес тайла для каждого кода сверен с образцом `src/layers.js` на одном `z/x/y`, нет `nakarte.me`, retina-варианты; проверка: `npm test` зелёный
- [x] 3.2 `web/src/layers/style.ts`: `buildStyle(selection, catalog, customLayers)` вместо `osm-style.ts` — подложка и оверлеи в порядке наложения, `raster-opacity`, `minzoom` слоя, `bounds`, `hillshade` с `raster-dem` `terrarium`; unit-тест `style.test.ts` (порядок при любом порядке включения, отмывка, атрибуция); `osm-style.ts` и его тест удалены; проверка: `npm test` зелёный

## 4. Свои слои и настройки

- [x] 4.1 `web/src/layers/custom.ts`: код `-cs` ↔ поля как `serializeCustomLayer`/`loadCustomLayerFromString`, поле `corsProxy`, перевод токенов (`{s}`, `{r}`, `{-y}`, `tms`), отказ на `{z_1}`, `{x_1024}`, `{y_1024}`, адрес пробного тайла и проверка CORS (`cors` → `no-cors`); unit-тест `custom.test.ts` на кодах из `old-links.txt` и на проверке CORS с подменённым `fetch`; проверка: `npm test` зелёный
- [x] 4.2 `web/src/layers/settings.ts`: свой ключ `nakarte-web:layers` (видимость, свои слои, последний выбор), чтение `leafletLayersSettings` без своего ключа, пропуск удалённых кодов, `try/catch` вокруг `localStorage`; `parseLayers` для `l=` по правилам `unserializeState`; unit-тест `settings.test.ts` (сценарий «Сохранённые настройки со старыми кодами», свой ключ важнее старого, битый JSON) и `l=` (сценарии «Ссылка со слоями», «Ссылка с удалённым слоем», «Ссылка только с удалённым слоем», «Ссылка со своим слоем», `l=О` кириллицей, `l=O/M,`); проверка: `npm test` зелёный

## 5. Стор и карта

- [x] 5.1 `web/src/state/store.ts` (Zustand: `view`, `selection`, `layerSettings`) и `sync.ts` (старт: адрес → `localStorage` → умолчания; `moveend` → `m=` с debounce, смена слоёв → `l=` и `localStorage`; `hashchange` → стор → `jumpTo`); `BaseMap` берёт стиль из `buildStyle`, вид — из стора; `App` принимает `transformRequest` для тестов; unit-тест синхронизации с поддельными `location`/`history`/`localStorage`; проверка: `npm test` зелёный
- [x] 5.2 Тост ошибки тайлов по слою: id `tile-error:<код>`, название слоя в описании, без тоста на `404`; browser-тесты «Сервер тайлов недоступен» и «Тайла нет в покрытии» с `transformRequest` на фикстуру и на отсутствующий адрес; проверка: `npm test` зелёный

## 6. Переключатель

- [x] 6.1 Кнопка слоёв справа сверху над кнопками зума, `Popover`: подложки, оверлеи, подпись «zoom ≥ N», «Configure layers», «Add custom layer»; browser-тесты «Сменить подложку», «Порядок оверлеев», «Включить отмывку», «Атрибуция слоя», «Клик по панели» для поповера; проверка: `npm test` зелёный
- [x] 6.2 Диалог «Configure layers» (группы, видимость в списке, Reset/Cancel/Ok); хоткеев слоёв нет (решение владельца); browser-тест «Скрыть слой из списка»; проверка: `npm test` зелёный
- [x] 6.3 Диалог своего слоя (добавить, изменить, удалить; проверка CORS, «Use proxy»); browser-тесты «Добавить свой слой», «Неподдерживаемый шаблон»; проверка: `npm test` зелёный

## 7. e2e

- [x] 7.1 `web/e2e/fixtures.ts`: регулярки тайлов из `buildCatalog` (растр и DEM), свой хост `tiles.example.test` с CORS и без, адрес прокси; всё остальное мимо `localhost` — `abort` и провал теста; учёт запрошенных тайлов по коду слоя; проверка: существующие e2e зелёные
- [x] 7.2 e2e по сценариям спек: «Первый заход без настроек», «Ссылка с видом», «Неверный вид в ссылке», «Вид пишется в адрес», «Ссылка со слоями», «Ссылка с удалённым слоем», «Ссылка только с удалённым слоем», «Ссылка со своим слоем», «Перезагрузка без l=», «Сохранённые настройки со старыми кодами», «Слой Strava», «Региональный слой вне покрытия», «Слой с минимальным зумом», «Сервер без CORS», «Слой через прокси», «Список слоёв»; проверка: `npm run build && npm run e2e` зелёный, `check web` на PR зелёный

## 8. Проверки и документы

- [x] 8.1 Замер `phys_footprint` на эмуляции Pixel 7: только OSM против OSM + `Wh` + `Hs`, после загрузки и после 6 прокруток с зумом; итог — в design, «Проверки»
- [x] 8.2 `AGENTS.md`, раздел «Новое приложение»: модули слоёв и адреса, подвохи (редиректы без CORS у провайдеров, Google `z=`, Bing без ключа, `ALLOWED_ORIGINS` прокси без портов `web/`, тайлы в тестах через `transformRequest` и регулярки каталога); `docs/architecture` — только если меняется схема (новое приложение описано в design до change переключения); проверка: ссылки на файлы и разделы существуют, `openspec validate --all --strict`
- [x] 8.3 После деплоя: все 31 слой на `https://nakarte-routing.pages.dev/next/` в браузерной панели (тайлы `200`, прокси для Strava и `Mt`), ссылка старого клиента с `l=` и настройки `leafletLayersSettings` подхватываются; итог — в design

## Workflow follow-up

- PR в `master`, `gh pr checks <N> --watch`, затем `gh pr checks <N>` без `--watch` — merge только при всех `pass`.
- Проверка 8.3 после деплоя, итог в design, `/opsx:archive`, архив вторым PR; относительные ссылки в архивных файлах сдвигаются на уровень — проверить.
