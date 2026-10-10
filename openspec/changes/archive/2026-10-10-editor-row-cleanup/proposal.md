# Proposal

## Why

Фидбек владельца 2026-10-10 после `search-track-links` (backlog, «Интерфейс после макета 4a», первый из трёх changes): строка редактора перегружена — кнопка `Done` с текстом, подсказки рисования, которые повторяют очевидное, и пункт про хоткеи в меню прокладки; а цвет трека во время правки не сменить — список треков закрыт, пока линия редактируется.

## What Changes

- **`Done` → круглая иконка-галочка** с `title` и `aria-label` «Finish editing»; поведение то же (заканчивает редактирование).
- **Подсказки рисования уходят**: «Click map to add points» и «Drag points, click line end to continue» больше не показываются; строка подсказки под редактором есть только у выбора на карте для Join и Shortcut («Click a track line to join it», «Click the line where the shortcut ends»).
- **Пункт меню прокладки «Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z: undo, redo» уходит**; хоткеи остаются в `title` кнопок Undo и Redo.
- **Цвет трека в строке редактора**: цветная полоска слева от названия — кнопка, открывающая ту же палитру из шести цветов, что в списке треков; работает для любого редактируемого трека, в том числе только что созданного, и не заканчивает редактирование.
- Не в этом change: панель точек трека (`Done`/`Cancel` и подсказки режима точек — прежние), контрастность треков, линейка, атрибуция (change `map-chrome`), панель All layers (change `compact-all-layers`).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `route-editing`: «Начало и конец редактирования» — кнопка «Finish editing» вместо Done; «Название трека в панели редактирования» — сценарий говорит о «Finish editing»; новое требование «Цвет трека в панели редактирования».
- `tracks`: «Кнопка профиля высот» и «Поделиться треком из панели редактирования» — Done переименован в «Finish editing».

## Impact

- Код: `web/src/routing/EditPanel.tsx` (кнопка, подсказка, палитра), `web/src/routing/RoutingButton.tsx` (пункт меню), палитра из `web/src/tracks/TrackList.tsx` выносится в свой файл и используется обоими.
- Тесты: browser `RouteEditor`, `LineTools`, `TrackList` и e2e `route-editing`, `line-tools`, `autosave`, `search` ищут `Done` и убранные подсказки — меняется только способ поиска, сценарии те же; новый browser-тест выбора цвета в редакторе.
- Сервисы, форматы ссылок, файлов и автосохранения — не меняются.
- Документы: абзац «Раскладка» в `AGENTS.md` (Done → «Finish editing»), строка раскладки в `docs/architecture/decisions.md`, `openspec/backlog.md` (часть пункта фидбека и пункт про цвет во время правки).
