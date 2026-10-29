# Proposal

## Why

В меню трека пять пунктов, и три из них — разные способы сохранить GPX: «Save as GPX», «Save as GPX with elevation» и «Send to device» (окно с шторкой Web Share и инструкцией для Garmin, Wahoo и COROS). В меню списка треков есть «Save all tracks to ZIP file». Владелец (2026-10-29): «тут много лишнего» — GPX сохранять всегда с высотами, не говоря об этом в меню, «Send to device» и ZIP удалить.

## What Changes

- «Save as GPX» сохраняет GPX с высотами из API высот (`<ele>`), как раньше «Save as GPX with elevation». Если API высот недоступен, сохраняется тот же GPX без `<ele>`, без сообщения.
- **BREAKING** Пункт «Save as GPX with elevation» удалён из меню трека и меню «Share track» редактора.
- **BREAKING** «Send to device» удалён целиком: пункт меню, окно, шторка Web Share и инструкция для приложений устройств. Маршрут на устройство — файлом «Save as GPX».
- **BREAKING** «Save all tracks to ZIP file» удалён из меню списка треков вместе с экспортом ZIP. Импорт ZIP остаётся.

## Capabilities

### New Capabilities

### Modified Capabilities

- `track-files`: требование «Экспорт треков» заменено на «Экспорт трека» (без ZIP); «GPX с высотами» — это «Save as GPX», ошибка API даёт GPX без высот; требования «Файл для устройства», «Шторка “Поделиться” с откатом на скачивание» и «Инструкция для приложений устройств» удалены.
- `tracks`: «Действия со списком» — без ZIP; «Поделиться треком из панели редактирования» заменено на «Меню “Share track”» без «Send to device».

## Impact

- `web/src/tracks/TrackExportItems.tsx`, `TrackList.tsx`, `TrackDialogs.tsx` (без окна «Send to device»), `actions.ts` (`saveGpx` с высотами и `saveKml`; без `saveAll`, `sendToDevice`, шторки), `web/src/routing/EditPanel.tsx` (спиннер на «Share track»), `export.ts` (без `exportZip`), `web/src/state/store.ts` (без `deviceFile`), `web/src/App.tsx` и `web/src/test/render-app.tsx` (без пропа `shareFiles`).
- Тесты: `web/src/tracks/actions.test.ts`, `export.test.ts`, `TrackList.browser.test.tsx`, `web/src/routing/RouteEditor.browser.test.tsx`, `web/e2e/elevation-profile.spec.ts`.
- Документы: `AGENTS.md` (абзац треков), `docs/architecture/decisions.md` (строка маршрута на устройство), `openspec/backlog.md` (пункт отправки на устройство).
