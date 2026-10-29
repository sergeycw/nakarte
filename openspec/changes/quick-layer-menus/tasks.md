# Tasks

## 1. Группы и память

- [x] 1.1 Группы `QUICK_BASE_GROUPS` и `QUICK_OVERLAY_GROUPS`, производная `QUICK_BASES`, `quickGroupOf`, `rememberQuickLayer` и `quickTarget` в `quick-layers.ts` (бывший `quick-bases.ts`, импорт в `scripts/layer-thumbnails.mjs`); проверка: unit-тест `quick-layers.test.ts` (группы сверены с каталогом, память, цель нажатия) зелёный
- [x] 1.2 Поле `quickLayers` в `LayerSettings` (`settings.ts`), запись в `selectBase`, `toggleOverlay`, `applyLayersParam`, действие `setQuickOverlay`, `fallBackBase` память не трогает (`store.ts`); проверка: unit-тесты `settings.test.ts` (чтение поля, настройки без поля) и `store.test.ts` «Откат не меняет память» зелёные

## 2. Значок и меню

- [x] 2.1 Круг отмечен по группе и включает цель `quickTarget`, кнопка хитмэпа с памятью вместо переключателей `Sa` и `Hs`, значок меню группы у левого нижнего края, поле столбца `px-2` (`QuickLayers.tsx`, `LayerSwitcher.tsx`); проверка: browser-тесты `LayerSwitcher.browser.test.tsx` по сценариям «Превью подложек справа», «Переключатели оверлеев справа», «Меню слоёв столбца» и «Круг помнит выбор типа» зелёные
- [x] 2.2 Полный прогон; `ImageryDate.browser.test.tsx` чистит `localStorage` перед тестом (память кругов переходила из теста в тест); проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` и `npm run lint` из корня зелёные (CI — `check-web.yml`, `check-lint.yml`)

## 3. Документы

- [x] 3.1 `AGENTS.md` («Раскладка»), `docs/architecture/decisions.md` (строка раскладки), `openspec/backlog.md` (замена Google Map — первый код группы); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 4. Ревью и вид

- [ ] 4.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [ ] 4.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge: круги со значками и открытые меню

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после quick-layer-menus» в промпте следующей сессии.
