# Tasks

## 1. Подсказка у точки

- [x] 1.1 Точка начала выбора `toolOrigin` (`line-tools.ts`, общая с линией выбора), плашка `ToolHintOnMap.tsx` (над точкой или под ней, прижатие к краю, сквозная для кликов), монтирование в `BaseMap.tsx`, строка подсказки уходит из `EditPanel.tsx`; browser «Подсказка у конца линии» и «Подсказка у места начала» (`LineTools.browser.test.tsx`); проверка: browser `LineTools` и `RouteEditor` зелёные
- [x] 1.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Инструменты линии»: подсказка на карте; «Раскладка» — без подсказки в строке), `openspec/backlog.md` (пункт подсказки — при archive); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800), Pixel 7 и Pixel 7 landscape владельцу до merge: Join и Shortcut на треке из GPX; проверка: кадры отправлены
- [x] 3.3 Прод после `slope-profile`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
