# Tasks

## 1. Операции над линией

- [x] 1.1 `web/src/routing/line-tools.ts`: `splitLeg`, `cutLine`, `reverseLine`, `joinLines`, `shortcutLine`, `shortcutRemoved`; `insertWaypoint` редактора — на `splitLeg`; unit-тест `line-tools.test.ts` (проложенные, прямые, непроложенные, ожидающие отрезки; разметка проходит `routeFits`, `simplifyRouted` сохраняет опорные точки); проверка: `npm test` зелёный
- [x] 1.2 `editor.ts`: `shortcut` и `reverse` — шаг истории; unit-тест `editor.test.ts`; проверка: `npm test` зелёный
- [x] 1.3 `editing.ts`: Cut, Join, Delete segment, New track from segment над треком (места отрезков, разметка, ожидающие → непроложенные, новый редактор с пустой историей), Shortcut, Reverse, Delete point через редактор; стор — `lineTool`, `mapMenu`; unit-тест `editing.test.ts`; проверка: `npm test` зелёный

## 2. Меню и выбор на карте

- [x] 2.1 `MapMenu.tsx` (меню в точке, `anchor` в `DropdownMenuContent`), `MapEditor.tsx`: правый клик по опорной точке, отрезку и линии трека, долгое нажатие, касание линии со вставкой при сдвиге или отпускании; browser-тест сценариев «Меню опорной точки и линии» и «Удаление опорной точки из меню»; проверка: `npm test` зелёный
- [x] 2.2 Выбор Join и Shortcut на карте: превью с подсветкой (`edit-style.ts`), клики, Escape/Enter, Cancel и подсказки в `EditPanel.tsx`; browser-тест сценариев «Разрез отрезка», «Склейка отрезков», «Срез участка», «Разворот отрезка», «Удаление и вынос отрезка», «Разметка маршрута после правки линии» (с перезагрузкой); проверка: `npm test` зелёный

## 3. Точки трека

- [x] 3.1 `actions.ts`: `addPoint`, `renamePoint`, `movePoint`, `removePoint`, `copyPointCoordinates`, `nextPointName`; стор — `pointTool`, `pointDialog`; unit-тест; проверка: `npm test` зелёный
- [x] 3.2 «Add point» в меню трека, `PointPanel.tsx`, окно названия, меню точки по клику, номер точки в фиче (`style.ts`), обобщённое окно копирования; browser-тест сценариев «Добавление точек трека» и «Меню точки трека»; проверка: `npm test` зелёный

## 4. e2e и замеры

- [x] 4.1 e2e `line-tools.spec.ts`: Cut проложенного отрезка и перезагрузка, Join двух отрезков трека и ссылка в новом контексте браузера, точка трека с переименованием, долгое нажатие настоящим касанием; проверка: `npm run build && npm run e2e` зелёный, `check web` на PR зелёный
- [x] 4.2 Замер Cut и Shortcut на линии из 10 и 100 тыс. опорных точек (время на главном потоке), итог в design
- [x] 4.3 Скриншоты меню опорной точки, выбора Join/Shortcut и меню точки трека владельцу (SendUserFile)

## 5. Документы

- [x] 5.1 `AGENTS.md`, раздел «Новое приложение»: модули инструментов линии и точек, подвохи apply; backlog — undo операций списка, стык Join с прокладкой; проверка: ссылки на файлы и разделы существуют, `openspec validate --all --strict`

## Workflow follow-up

- Независимое ревью диффа субагентом до PR.
- PR в `master`, `gh pr checks <N> --watch`, затем `gh pr checks <N>` без `--watch` — merge только при всех `pass` на последнем коммите.
- После деплоя (`gh run watch` для `deploy pages`): на `https://nakarte-routing.pages.dev/next/` Cut, Join, Shortcut маршрута настоящим движком, перезагрузка, «Copy link»; итог в design.
- `/opsx:archive`, архив вторым PR; ссылки в архивных файлах сдвигаются на уровень; отметить 6б в таблице ресёрча сделанным.
- Промпт change 7 (`add-web-elevation-profile`) — последним блоком отчёта; новую сессию запускает владелец.
