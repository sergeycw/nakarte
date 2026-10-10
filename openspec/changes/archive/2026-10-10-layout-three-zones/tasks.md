# Tasks

## 1. Раскладка

- [x] 1.1 Слева сверху: капсула поиска, круглые `Tracks` (значок числа), `New track`, `Measure distance` (`TopBar.tsx`, `TrackList.tsx`); проверка: browser-тесты `TrackList`, `Ticks`, `App` зелёные
- [x] 1.2 Справа: круглая кнопка слоёв, Street View контролом MapLibre, зум капсулой без номера, геолокация кругом (`LayerSwitcher.tsx`, `MapButtons.tsx`, `index.css`); тест «Номер зума» → «Линейка масштаба»; проверка: browser-тесты `MapButtons`, `GeolocationDenied`, `StreetView`, `LayerSwitcher` зелёные
- [x] 1.3 Снизу по центру: кнопка профиля только у активного маршрута, без подписи; атрибуция и линейка масштаба у нижнего края (`MapActions.tsx`, `BaseMap.tsx`); проверка: browser-тесты `ElevationProfile`, `StreetView` зелёные, вид — скриншотами (тесты раскладки — backlog по решению владельца)
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `docs/architecture/decisions.md` (строка раскладки), `AGENTS.md` (абзац «Раскладка»), `openspec/backlog.md` (сценарии без тестов), ресёрч (строка 1 — сделан); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design change `layer-thumbnails`.
