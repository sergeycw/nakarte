# Tasks

## 1. Карта

- [x] 1.1 Треки: обводка `tracks-casing` под непрозрачной линией, обводка редактируемой линии (`tracks/style.ts`, `routing/edit-style.ts`), палитра `TRACK_COLORS` (`tracks/model.ts`); тесты с литералами старой палитры — через `TRACK_COLORS` (browser `TrackList`, `RouteEditor`, `Autosave`), порядок слоёв — `style.test.ts`; проверка: эти тесты зелёные
- [x] 1.2 Атрибуция compact и сворачивание по движению пользователя (`map/MapButtons.tsx`), стекло линейки и атрибуции и положение слева снизу (`index.css`, `BaseMap.tsx`); browser-тест «Сворачивание по первому движению карты» (`MapButtons.browser.test.tsx`); проверка: browser `MapButtons` зелёный
- [x] 1.3 Подпись Tracestrack из условий (`layers/catalog.ts`); «Атрибуция Tracestrack» сверяет подпись целиком (`App.browser.test.tsx`); проверка: browser `App`, unit `catalog` зелёные
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Раскладка»: слева снизу), строка раскладки в `docs/architecture/decisions.md`, `openspec/backlog.md` (условия Strava; часть `map-chrome` пункта фидбека — при archive); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge: треки на OSM, Tracestrack, спутнике и Strava heatmap, линейка рядом с кнопкой профиля, атрибуция до и после движения карты; проверка: кадры отправлены
- [x] 3.3 Прод после `editor-row-cleanup`: `prod check`, вид `/` на компьютере и Pixel 7; итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change (`compact-all-layers`).
