# Tasks

## 1. Поиск и список

- [x] 1.1 Узнавание ссылки на трек без сети отделено от загрузки (`matchTrackLink` в `tracks/import-url.ts`), `loadFromUrl` через него; unit-тесты `import-url.test.ts`; проверка: unit `import-url`, `track-files`, browser `TrackList` зелёные
- [x] 1.2 Ссылки на треки в поиске: порядок результатов, «любой файл», OSM без `map=` — не вид, `track://` (`search/search.ts`, `links.ts`, `result.ts`), выбор результата-трека — `openUrl` с показом трека, очистка строки, плейсхолдер (`SearchBox.tsx`, `tracks/actions.ts`); unit `search.test.ts`, `links.test.ts`, browser `Search.browser.test.tsx`; проверка: эти тесты зелёные
- [x] 1.3 Поле `Track URL` и `Download URL` уходят из `TrackList.tsx`, подсказка пустого списка; тесты поля — на поиск и поле названия (browser `TrackList`, `RouteEditor`, e2e `tracks`); проверка: эти тесты зелёные
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `docs/architecture/decisions.md` (строка раскладки), `AGENTS.md` (абзацы «Треки» и «Поиск…»), `openspec/backlog.md` (пункт о названии из поля ссылки — убрать, пункт про Alt+L), ресёрч (строка 4 — сделан); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800) и `Pixel 7` владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
