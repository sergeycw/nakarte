# Tasks

## 1. Меню трека и списка

- [x] 1.1 «Save as GPX» — с высотами, ошибка API высот — GPX без `<ele>` без сообщения (`saveTrack` в `actions.ts`), пункта «Save as GPX with elevation» нет (`TrackExportItems.tsx`); проверка: unit-тесты `actions.test.ts` «Сохранить с высотами…», «Сервис недоступен», `export.test.ts` «Сохранить с высотами», «Точка без данных», e2e `elevation-profile.spec.ts` «Сохранить с высотами» зелёные
- [x] 1.2 Удалить «Send to device»: пункт, окно `DeviceSendDialog`, шторку (`browserShareFiles`, проп `shareFiles` у `App` и `renderApp`), `deviceFile` стора и их тесты; проверка: `npm run typecheck` и `npm test` зелёные, browser-тесты `RouteEditor.browser.test.tsx` «Экспорт из редактора» и «Пункты меню Share track» зелёные
- [x] 1.3 Удалить «Save all tracks to ZIP file» и `exportZip` с тестом (`TrackList.tsx`, `export.ts`, `actions.ts`); проверка: `npm test` и e2e `tracks.spec.ts` «Сохранить в GPX» зелёные
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац треков и профиля высот), `docs/architecture/decisions.md` (строка маршрута на устройство), `openspec/backlog.md` (пункт отправки на устройство); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью и вид

- [ ] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [ ] 3.2 Скриншоты меню трека и меню списка (компьютер 1280×800 и `Pixel 7`) владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзацем «Прод после trim-track-menus» в промпте следующей сессии.
