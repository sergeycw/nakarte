# Tasks

## 1. Быстрые слои

- [x] 1.1 Превью подложек: скрипт `scripts/layer-thumbnails.mjs`, картинки `web/src/layers/thumbnails/*.webp`; проверка: `npm run lint` из корня зелёный, `npm run build` в `web/` без предупреждений о картинках
- [x] 1.2 Столбец справа: превью, переключатели `Sa` и `Hs`, `All layers` с прежним поповером; контрол MapLibre первым, контейнер `top-1!` (`QuickLayers.tsx`, `LayerSwitcher.tsx`, `map/control-portal.tsx`, `MapButtons.tsx`, `BaseMap.tsx`, `App.tsx`); `Sa` в списке по умолчанию (`catalog.ts`); проверка: browser-тесты `LayerSwitcher`, `MapButtons`, `StreetView` и e2e `map-layers` зелёные
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `docs/architecture/decisions.md` (строка раскладки), `AGENTS.md` (абзац «Раскладка», подвох про `top-12!`), `openspec/backlog.md` (сценарии без тестов), ресёрч (строка 2 — сделан); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design change `editor-name-share`.
