# Tasks

## 1. Поиск без карты

- [x] 1.1 `web/src/search/coordinates.ts` и `links.ts` (порт старого, зум MapLibre, короткие ссылки через `fetch` и прокси, капча Google по `continue`); unit-тесты `coordinates.test.ts`, `links.test.ts` со всеми случаями karma-тестов старого; проверка: `npm test` зелёный
- [x] 1.2 `mapycz.ts`, `photon.ts` (адрес запроса, разбор ответа, языки), `search.ts` (ссылка → координаты → mapy.cz → photon, ошибки); фикстуры ответов в `src/search/fixtures/`; unit-тесты; проверка: `npm test` зелёный

## 2. Поиск и метка в приложении

- [x] 2.1 Стор `placemark`, `r=` в `sync.ts` (старт, `hashchange`, запись), разбор и запись `r=` (`search/placemark-hash.ts`); unit-тесты `sync.test.ts` и разбора; проверка: `npm test` зелёный
- [x] 2.2 `SearchBox.tsx` в `InfoPanel`: ввод с задержкой и отменой, результаты, клавиши, Alt+L, подпись сервиса, ошибки; `Placemark.tsx`: метка, клик по метке (точка трека с названием, опорная точка), снятие кликом по карте в `MapEditor`; `addPoint` с необязательным названием; browser-тест `Search.browser.test.tsx` — сценарии спеки `map-search`; проверка: `npm test` зелёный

## 3. Кнопки карты, внешние карты, геолокация, масштаб

- [x] 3.1 `map/external.ts` (адреса, пределы зума, Google Earth с высотой и без); unit-тест; проверка: `npm test` зелёный
- [x] 3.2 `map/locate.ts` (запомненное положение, старый ключ), заход без `m=` на запомненное положение; unit-тест; проверка: `npm test` зелёный
- [x] 3.3 `MapButtons.tsx`: `GeolocateControl` с тостами ошибок, номер зума, `ScaleControl`, группа кнопок (Street View, линейка, внешние карты с меню); browser-тест `MapButtons.browser.test.tsx` — сценарии «Открыть место на другой карте», «Где я», «Последнее положение при заходе», «Масштаб и зум на карте»; проверка: `npm test` зелёный

## 4. Отметки расстояния и линейка

- [x] 4.1 `tracks/ticks.ts` (шаг, отметки отрезка, угол); unit-тест `ticks.test.ts` по сценариям спеки; проверка: `npm test` зелёный
- [x] 4.2 Источник и слой `track-ticks`, флажок «Show distance marks» в меню трека, «Measure distance» (`newTrack('Ruler')` с отметками); browser-тест — сценарии «Отметки расстояния» и «Линейка»; проверка: `npm test` зелёный

## 5. Street View

- [x] 5.1 `streetview/hash.ts` (`n2=`, `n=`, удалённые провайдеры), стор `streetView`, `n2=`/`n=` в `sync.ts`; unit-тесты; проверка: `npm test` зелёный
- [x] 5.2 `streetview/api.ts`, `google.ts` (загрузка по требованию с `callback`, свои типы, `keyless.css`, ключ `VITE_GOOGLE_MAPS_API_KEY` в `config.ts`), `controller.ts` (поиск по клику, устаревшие ответы, тост); unit-тест контроллера и загрузчика на поддельном `document`/`window`; проверка: `npm test` зелёный
- [x] 5.3 Покрытие в стиле, клик в `MapEditor`, `StreetViewPanel.tsx` (панель, закрытие, `--bottom-inset` с профилем), `StreetViewOnMap.tsx` (метка направления, сдвиг карты за край), Alt+P; проп `streetView` у `App`, `src/test/fake-street-view.ts`; browser-тест `StreetView.browser.test.tsx` — сценарии спеки `street-view`; проверка: `npm test` зелёный
- [x] 5.4 `deploy-pages.yml`: `VITE_GOOGLE_MAPS_API_KEY` из `GOOGLE_MAPS_API_KEY` только шагу `web build`; проверка: `actionlint` или разбор YAML, сборка без переменной зелёная

## 6. e2e, замеры, вид

- [x] 6.1 `e2e/fixtures.ts`: ответы mapy.cz и photon, тайлы покрытия, заглушка Maps JavaScript API; e2e `search.spec.ts` и `street-view.spec.ts` (поиск и метка в адресе, `r=`, `n2=` и `n=`, панорама по клику, линейка); проверка: `npm run build && npm run e2e` зелёный, `check web` на PR зелёный
- [x] 6.2 Замер `phys_footprint` с настоящим Maps JavaScript API (dev-сервер, без ключа): до режима, с открытой панорамой, после закрытия и после выключения режима; итог в design
- [x] 6.3 Скриншоты (компьютер и телефон 390 px: поиск с результатами, метка, панорама с профилем, линейка, меню внешних карт) владельцу через SendUserFile

## 7. Документы

- [x] 7.1 `AGENTS.md`, раздел «Новое приложение»: модули поиска, Street View, кнопок карты, отметок; подвохи apply; backlog — исправить риск поиска, `maps.app.goo.gl`; проверка: ссылки на файлы и разделы существуют, `openspec validate --all --strict`

## Workflow follow-up

- Независимое ревью диффа субагентом до PR.
- PR в `master`, `gh pr checks <N> --watch`, затем `gh pr checks <N>` без `--watch` — merge только при всех `pass` на последнем коммите.
- После деплоя (`gh run watch` для `deploy pages`): на `https://nakarte-routing.pages.dev/next/` поиск mapy.cz, короткая ссылка mapy.com, панорама без ключа, Google Earth, геолокация; итог в design.
- `/opsx:archive`, архив вторым PR; ссылки в архивных файлах сдвигаются на уровень; отметить 8 в таблице ресёрча сделанным.
- Промпт change 9 (`switch-to-web-app`) — последним блоком отчёта; новую сессию запускает владелец.
