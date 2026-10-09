# Tasks

## 1. Расчёт и API без карты

- [x] 1.1 `web/src/elevation/profile.ts`: `samplingInterval`, выборка отрезков (конец входит, стык без промежутка, расстояния), `profileStats` (исправления старого расчёта), `gridValues`; unit-тест `profile.test.ts`; проверка: `npm test` зелёный
- [x] 1.2 `web/src/elevation/api.ts`: `fetchElevations` (куски по 10 000, `NULL`, долгота за 180°, ошибки с причиной); unit-тест `api.test.ts`; проверка: `npm test` зелёный
- [x] 1.3 GPX с высотами: `toGpx` с `<ele>`, `saveTrackWithElevation` в `tracks/actions.ts` (пустой трек, ошибка без файла, индикатор загрузки); unit-тесты `export.test.ts`, `actions.test.ts`; проверка: `npm test` зелёный

## 2. Профиль в приложении

- [x] 2.1 Стор (`profile`, `profileData`, `profileCursor`, `profileSelection`), `controller.ts` (первый запрос сразу, пауза 1 с, ожидающие отрезки, закрытие при удалении трека и смене числа отрезков, устаревшие ответы, Retry); unit-тест `controller.test.ts`; проверка: `npm test` зелёный
- [ ] 2.2 `ElevationProfile.tsx`: панель снизу, сводка, график SVG, курсор, выделение мышью, зум колесом, касание, двойной клик, ошибка и Retry, атрибуция (`config.ts`); `--bottom-inset` для панелей, атрибуции карты и тостов; пункты «Show elevation profile» и «Save as GPX with elevation» в меню трека, «Show elevation profile for segment» в `MapMenu.tsx`
- [ ] 2.3 `ProfileOnMap.tsx`: метка курсора, источник и слой выделения в стиле, наведение на линию профиля проекцией; browser-тест `ElevationProfile.browser.test.tsx` — сценарии «Профиль высот трека и отрезка», «Сводка профиля», «Курсор профиля и карта», «Профиль следует за треком», «Ошибка сервиса высот в профиле», «Меню опорной точки и линии»; проверка: `npm test` зелёный

## 3. e2e и замеры

- [ ] 3.1 e2e `elevation-profile.spec.ts` и заглушка сервиса высот в `e2e/fixtures.ts`: профиль трека из ссылки с наведением, профиль отрезка из меню линии, «Save as GPX with elevation» с `<ele>`; проверка: `npm run build && npm run e2e` зелёный, `check web` на PR зелёный
- [ ] 3.2 Замер на треке 100 тыс. точек: время от пункта меню до графика, время наведения на линию, число запросов профиля и GPX; итог в design
- [ ] 3.3 Скриншоты профиля (компьютер и телефон 390 px, курсор, выделение, ошибка) владельцу (SendUserFile)

## 4. Документы

- [ ] 4.1 `AGENTS.md`, раздел «Новое приложение»: модули профиля, подвохи apply; backlog — зум и выделение профиля пальцем; проверка: ссылки на файлы и разделы существуют, `openspec validate --all --strict`

## Workflow follow-up

- Независимое ревью диффа субагентом до PR.
- PR в `master`, `gh pr checks <N> --watch`, затем `gh pr checks <N>` без `--watch` — merge только при всех `pass` на последнем коммите.
- После деплоя (`gh run watch` для `deploy pages`): на `https://nakarte-routing.pages.dev/next/` профиль трека и отрезка с живым API, правка с профилем, «Save as GPX with elevation», замер GPX на большом треке; итог в design.
- `/opsx:archive`, архив вторым PR; ссылки в архивных файлах сдвигаются на уровень; отметить 7 в таблице ресёрча сделанным.
- Промпт change 8 (`add-web-search-panoramas`) — последним блоком отчёта; новую сессию запускает владелец.
