# Tasks

## 1. Модель и форматы

- [x] 1.1 `TrackColor` и `trackColor` в `tracks/model.ts`, `tracks/color.ts` (hex, HSV, разбор, ближайший цвет палитры, нормализация), краска через `trackColor` в `tracks/style.ts`, `map/BaseMap.tsx`, `routing/MapEditor.tsx`, `elevation/ElevationProfile.tsx`, `tracks/PointPanel.tsx`, проверка цвета в `addTracks` (`state/store.ts`); unit `color.test.ts`; проверка: unit зелёный, `npm run typecheck`
- [x] 1.2 Поле `View.rgb` в `nktk.proto` и `nktk.ts`, `c` в `links.ts`, `SavedTrack.color` в `autosave/saved.ts`; unit «Ссылка со своим цветом», «Читатель без поля rgb», «Цвет палитры в ссылке» (`nktk.test.ts`), «Свой цвет в nktj» (`links.test.ts`), свой цвет и старый номер (`saved.test.ts`); проверка: unit зелёный

## 2. Пикер

- [x] 2.1 `HsvPicker.tsx`, `recent-colors.ts`, палитра с пикером в `ColorPicker.tsx`; browser «Свой цвет из поля hex», «Свой цвет перетаскиванием», «Свой цвет с клавиатуры», «Набранный hex при закрытии», «Неверный hex», «Недавние цвета» (`TrackList.browser.test.tsx`), «Свой цвет после перезагрузки» (`Autosave.browser.test.tsx`), «Свой цвет во время правки» (`RouteEditor.browser.test.tsx`); проверка: эти browser-файлы зелёные
- [x] 2.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 3. Документы

- [x] 3.1 `AGENTS.md` (абзацы «Треки» и «Автосохранение»: цвет трека и поле `rgb`); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 4. Ревью, PR, прод

- [x] 4.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 4.2 Скриншоты компьютера (1280×800), Pixel 7 и Pixel 7 landscape владельцу до merge: палитра с пикером в строке редактора и в списке треков, трек из GPX в своём цвете; проверка: кадры отправлены
- [x] 4.3 Прод после `editor-routing-indicator`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом. В backlog пункта нет — при archive ничего не убирать.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
