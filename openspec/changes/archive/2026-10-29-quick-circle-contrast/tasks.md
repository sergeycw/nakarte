# Tasks

## 1. Вид

- [x] 1.1 Кольцо и тень кругов (`CIRCLE_RING`), тёмный значок с белой стрелкой и обводкой (`MENU_BADGE`, вариант `default`) в `QuickLayers.tsx`; проверка: browser-тест `LayerSwitcher.browser.test.tsx` «Контраст кругов и значков» зелёный
- [x] 1.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` («Раскладка»); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью и вид

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты столбца (компьютер 1280×800 и `Pixel 7`) владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после quick-circle-contrast» в промпте следующей сессии.
