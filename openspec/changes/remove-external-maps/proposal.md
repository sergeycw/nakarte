# Proposal

## Why

Владелец 2026-10-09 (по скриншоту меню в сессии change `polish-web-ui`): меню «Open this place in» с семью сторонними картами — лишняя функция. Её перенёс change 8 ([add-web-search-panoramas](../archive/2026-10-09-add-web-search-panoramas/design.md#внешние-карты)) как функцию старого клиента; неиспользуемый код в форке удаляется, а не прячется (`AGENTS.md`, «Апстрим»).

## What Changes

- Кнопки внешних карт в столбце справа и её меню нет; модуль адресов внешних карт и высота камеры Google Earth удаляются вместе с тестами.
- Сервис высот больше не зовётся для внешних карт: только профиль и GPX с высотами.
- Остальные кнопки (Street View, «Measure distance», геолокация, зум) — без изменений.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-client`: удалено «Открыть место на другой карте».
- `clone-hosting`: «Свой сервис высот» и «Без слоёв mapy.cz» — без внешних карт.

## Impact

- Код: `web/src/map/external.ts` и `external.test.ts` удаляются, `web/src/map/MapButtons.tsx` (кнопка и проп `fetch`), `web/src/App.tsx`, `web/src/map/MapButtons.browser.test.tsx`.
- Документы: `AGENTS.md`, `docs/architecture/client.md`, `docs/architecture/elevation.md`, ресёрч (п. 5, строка «Внешние карты»).
- Ссылки, автосохранение, сервисы — не меняются.
