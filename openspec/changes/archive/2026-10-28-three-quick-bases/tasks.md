# Tasks

## 1. Три превью

- [x] 1.1 Константа `QUICK_BASES` (`quick-bases.ts`), столбец из трёх превью без подписей, ни одно не отмечено при подложке не из трёх, `fieldset` снова 36 px (`QuickLayers.tsx`, `LayerSwitcher.tsx`); удалить `short` из каталога и его тест; проверка: browser-тесты `LayerSwitcher.browser.test.tsx` «Подложка по превью», «Превью без настроек», «Выбранная подложка вне превью», «Скрытая подложка в превью» и unit-тест `catalog.test.ts` зелёные
- [x] 1.2 Превью по типу: `PLACES` и только `QUICK_BASES` в `scripts/layer-thumbnails.mjs`, без векторной ветки и даты `Hls`; переснять `Tt`, `G`, `E`, удалить остальные картинки; проверка: `npm run lint` из корня зелёный, browser-тест «Превью без настроек» видит картинку у каждого превью
- [x] 1.3 Полный прогон; тесты `ImageryDate.browser.test.tsx` «Другая подложка» (OpenStreetMap — через `All layers`) и «Ссылка со снимками по датам» (три превью) — под новый столбец; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`, `check-lint.yml`); сценарий «Превью без запросов тайлов» — browser-тест с тем же названием (добавлен по ревью)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Раскладка» и абзац слоёв про превью `Of`), `docs/architecture/decisions.md` (строка раскладки), `openspec/backlog.md` (риск лицензии Google — Google Map в столбце); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью и вид

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после three-quick-bases» в промпте следующей сессии.
