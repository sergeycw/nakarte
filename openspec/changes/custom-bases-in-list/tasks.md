# Tasks

## 1. Список

- [x] 1.1 В `All layers` — только свои подложки и без хитмэпов, раздел без строк не рисуется, у первой секции оверлеев нет верхней линии, порядок столбца — кнопки с меню сверху, кнопка хитмэпа всегда (`LayerSwitcher.tsx`, `QuickLayers.tsx`); проверка: browser-тесты `LayerSwitcher.browser.test.tsx` «Полный список», «Хитмэпов в списке нет», «Своя подложка в списке», «Кнопка хитмэпа при снятом в Configure layers», «Снимки по датам под кнопками с меню» зелёные
- [x] 1.2 Галочки слоёв групп по умолчанию (`listedByDefault`), Reset, версия 2 настроек без прежних умолчаний (`settings.ts`, `ConfigureLayersDialog.tsx`); проверка: unit-тесты `settings.test.ts` «Слои меню отмечены по умолчанию», «Старые настройки галочек» и browser-тесты «Скрыть слой из списка», «Слой из меню после перезагрузки» зелёные
- [x] 1.3 Тесты, которые выбирали подложку или хитмэп в `All layers`, — кругами, кнопкой и меню (`LayerSwitcher.browser.test.tsx`, `ImageryDate.browser.test.tsx`, `e2e/map-layers.spec.ts`); проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` («Раскладка»), `docs/architecture/decisions.md` (строка раскладки); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью и вид

- [ ] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [ ] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge: открытый `All layers`

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после custom-bases-in-list» в промпте следующей сессии.
