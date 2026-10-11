# Tasks

## 1. Ожидание в строке

- [x] 1.1 `tracksRouting` в `routing/line.ts` (курсор `MapEditor.tsx` — через него), спиннер, подсказка и `aria-busy` у `RoutingButton.tsx` и `TracksButton` (`tracks/TrackList.tsx`); browser «Ожидание в строке редактора», «Ожидание, пока движок загружается», «Прокладку выключили во время ожидания», «Ожидание после конца правки», «Ответ снимает ожидание», «Ошибка снимает ожидание» (`RouteEditor.browser.test.tsx`); проверка: browser `RouteEditor` зелёный
- [x] 1.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Раскладка»: ожидание прокладки в строке), `openspec/backlog.md` (пункт — при archive); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800), Pixel 7 и Pixel 7 landscape владельцу до merge: прокладка отрезка на треке из GPX, ответ роутера придержан; проверка: кадры отправлены
- [x] 3.3 Прод после `editor-hint-at-point`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
