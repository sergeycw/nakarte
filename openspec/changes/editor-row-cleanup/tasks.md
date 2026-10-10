# Tasks

## 1. Строка редактора

- [x] 1.1 `Done` строки редактора → круглая кнопка-галочка «Finish editing» (`EditPanel.tsx`); тесты, искавшие `Done` редактора, — по новому имени (browser `RouteEditor`, `LineTools`; e2e `route-editing`, `line-tools`, `autosave`, `search`); проверка: эти browser-тесты зелёные
- [x] 1.2 Подсказки рисования уходят, строка подсказки — только у выбора Join и Shortcut, атрибут `data-drawing` у `edit-panel`; пункт меню прокладки про хоткеи уходит (`RoutingButton.tsx`); тесты подсказок — по `data-drawing` (browser `RouteEditor`, `LineTools`, `TrackList`); проверка: эти browser-тесты зелёные
- [x] 1.3 `ColorPicker` — в `tracks/ColorPicker.tsx`, в списке и в строке редактора; browser-тест «Цвет нового трека» (`RouteEditor.browser.test.tsx`); проверка: browser `RouteEditor`, `TrackList` зелёные
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Раскладка»: Done → «Finish editing», палитра в строке редактора), `openspec/backlog.md` (пункт про цвет во время правки; часть `editor-row-cleanup` пункта фидбека — при archive); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge; проверка: кадры в scratchpad отправлены
- [x] 3.3 Прод: подложка по умолчанию — Tracestrack без тоста отката (чистый контекст браузера); итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
