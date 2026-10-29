# Tasks

## 1. Панель и меню

- [x] 1.1 Секции оверлеев без сворачивания: `legend` вместо кнопки, без состояния раскрытия (`LayerSwitcher.tsx`); проверка: browser-тесты `LayerSwitcher.browser.test.tsx` «Полный список», «Хитмэпов в списке нет», «Оверлеи без сворачивания» и e2e `map-layers.spec.ts` «Перезагрузка без l=», «Сохранённые настройки со старыми кодами» зелёные
- [x] 1.2 Пункты меню `py-0.5` (`dropdown-menu.tsx`), строка `All layers` без `leading-tight`, строки 24 px у Configure layers, дат снимков, результатов поиска и списка треков; проверка: browser-тест «Строки списка и пункты меню одной высоты» зелёный
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 Правило единообразия и «Раскладка» в `AGENTS.md`, строка раскладки в `docs/architecture/decisions.md`; проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью и вид

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты `All layers` и меню круга (компьютер 1280×800 и `Pixel 7`) владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после uniform-layer-menus» в промпте следующей сессии.
