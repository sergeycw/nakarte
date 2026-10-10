# Tasks

## 1. Строка редактора

- [x] 1.1 Поле названия в строке редактора: черновик, Enter, уход фокуса и размонтирование — `rename`, Escape — откат (`TrackNameInput.tsx`, `EditPanel.tsx`), уже 640 px кнопки — иконками (`RoutingButton.tsx`), Alt+P не в полях (`MapButtons.tsx`); browser-тесты сценариев поля в `RouteEditor.browser.test.tsx`, e2e `search.spec.ts` — название значением поля; проверка: browser-тесты `RouteEditor`, `TrackList`, `StreetView`, `LineTools` и e2e `search`, `route-editing` зелёные
- [x] 1.2 Меню `Share track` рядом с `Done`: пункты экспорта — общий компонент с меню трека (`TrackExportItems.tsx`, `TrackList.tsx`, `EditPanel.tsx`); проверка: browser-тесты `TrackList`, `Ticks` и e2e `tracks` зелёные
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `docs/architecture/decisions.md` (строка раскладки), `AGENTS.md` (абзац «Раскладка»), `openspec/backlog.md` (пункт о списке во время правки, сценарии без тестов), ресёрч (строка 3 — сделан); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design change `search-track-links`.
