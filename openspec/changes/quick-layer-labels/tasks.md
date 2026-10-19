# Tasks

## 1. Подписи превью

- [x] 1.1 Короткое имя подложки: поле `short` у `LayerDef`, значения по таблице design (`catalog.ts`); проверка: unit-тест `catalog.test.ts` «У каждой подложки каталога короткое имя» зелёный
- [x] 1.2 Круг с подписью одной кнопкой, подпись выбранной отмечена, у своего слоя — `title` с `truncate`; столбец `w-16` с `-mx-3.5` и `min-w-0` (`QuickLayers.tsx`, `LayerSwitcher.tsx`); проверка: browser-тесты `LayerSwitcher.browser.test.tsx` «Подписи превью», «Подложка по подписи», «Подпись своего слоя» зелёные
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Раскладка»: подпись под превью, поле `short`), `docs/architecture/decisions.md` (строка раскладки, если там есть превью), `openspec/backlog.md` (вид подписей — в списке без тестов раскладки); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью и вид

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после quick-layer-labels» в промпте следующей сессии.
