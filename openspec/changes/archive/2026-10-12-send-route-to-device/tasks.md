# Tasks

## 1. Файл и шторка без React

- [x] 1.1 Состояние окна `deviceFile` в сторе (`src/state/store.ts`) и действия `sendToDevice`, `shareDeviceFile`, `downloadDeviceFile` в `src/tracks/actions.ts` (GPX с высотами, откат без высот, пустой трек, ответ после закрытия окна отброшен, `AbortError` — ничего, другой отказ — скачивание), зависимость `shareFiles` в `TrackActionsDeps`; unit-тесты «Файл для устройства», «Высоты недоступны», «Пустой трек на устройство» и отказов шторки в `actions.test.ts`; проверка: `npx vitest run src/tracks/actions.test.ts` зелёный

## 2. Окно и пункт меню

- [x] 2.1 Окно `DeviceSendDialog` в `src/tracks/TrackDialogs.tsx` (ожидание, строка ошибки высот, «Share» при `shareFiles`, «Download», инструкция Garmin Connect, Wahoo, COROS со ссылками из design), монтирование в `App.tsx`, пункт «Send to device» в `TrackExportItems.tsx`, проп `shareFiles` у `App` и `renderApp` (`src/test/render-app.tsx`); browser-тесты «Отправить через шторку», «Браузер не отдаёт файл», «Шторку закрыли», «Нет Web Share», «Инструкция для приложений» в `TrackList.browser.test.tsx` и «Send to device из редактора» в `RouteEditor.browser.test.tsx`; проверка: эти browser-тесты зелёные
- [x] 2.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 3. Документы

- [x] 3.1 `AGENTS.md` (абзац «Треки»: окно и проп `shareFiles`), `docs/architecture/decisions.md` (строка решения), `openspec/backlog.md` (пункт об отправке в приложение), ресёрч `device-route-sync` (строка 1 таблицы changes — сделан); проверка: скрипт ссылок — все файлы и разделы изменённых `.md` существуют, `openspec validate --all --strict`

## 4. Ревью

- [x] 4.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 4.2 Скриншоты окна на компьютере (1280×800) и `Pixel 7`

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` и меню трека на компьютере и Pixel 7; владелец проверяет шторку iOS с `.gpx` и импорт в Garmin Connect, Wahoo, COROS; итог — абзацем «Прод после `send-route-to-device`» в промпт следующей сессии.
