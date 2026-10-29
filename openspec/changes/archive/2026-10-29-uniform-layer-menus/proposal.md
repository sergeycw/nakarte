# Proposal

## Why

В `All layers` после `custom-bases-in-list` остались только оверлеи, и по умолчанию они свёрнуты под кнопкой `Overlays`: панель открывается пустой (владелец 2026-10-29, «не имеет смысла»). Владелец сравнил панель `All layers` и меню круга и увидел, что меню крупнее, и попросил одинаковый вид и правило единообразия. Замер: шрифт везде 14 px, но строка `All layers` — 24 px, а пункт меню — 28 px.

## What Changes

- **BREAKING** Секции оверлеев в `All layers` не сворачиваются: заголовок — подпись, все строки видны сразу.
- Пункты всех выпадающих меню (меню кругов и кнопки хитмэпа, трека, списка треков, прокладки, «Share track», меню на карте) — строка 24 px вместо 28 px, как строки `All layers`; шрифт 14 px везде.
- Те же 24 px у других списков: строки Configure layers и дат снимков (были 28 px), результаты поиска (28 px), строки списка треков (32 px). Заголовки секций Configure layers — без капса, как в `All layers`.
- Правило единообразия меню записано в `AGENTS.md`: 14 px и строка 24 px для пунктов и строк, 12 px для подписей секций и служебных кнопок, новое меню — общие компоненты `dropdown-menu.tsx` без своих размеров.

## Capabilities

### New Capabilities

### Modified Capabilities

- `map-layers`: «Полный список слоёв» — секции без сворачивания; требование «Секции оверлеев» заменено на «Секции оверлеев без сворачивания».
- `web-client`: новое требование «Единый вид меню».

## Impact

- `web/src/layers/LayerSwitcher.tsx` (секции без сворачивания, строка 24 px), `web/src/components/ui/dropdown-menu.tsx` (`py-0.5` у пунктов), `web/src/layers/ConfigureLayersDialog.tsx`, `web/src/layers/ImageryDate.tsx`, `web/src/search/SearchBox.tsx`, `web/src/tracks/TrackList.tsx` (строки 24 px).
- Тесты: `web/src/layers/LayerSwitcher.browser.test.tsx`, `web/e2e/map-layers.spec.ts`.
- Документы: `AGENTS.md` («Раскладка», правило единообразия), `docs/architecture/decisions.md` (строка раскладки).
