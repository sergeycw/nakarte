# Proposal

## Why

После `three-quick-bases` в столбце справа три круга по типу: топокарта, обычная карта, спутник. Остальные подложки того же типа (OpenTopoMap, OpenStreetMap, Bing Satellite и другие) доступны только в длинном `All layers`, а хитмэп Strava в столбце — только «all». Владелец (2026-10-29) предложил второе действие у круга: значок внизу открывает слева меню со слоями того же типа. Так же — у кнопки хитмэпа (бег, велосипед и другие). Кнопка отмывки в столбце лишняя.

## What Changes

- Каждый из трёх кругов — тип со своей группой подложек: топокарты (Tracestrack Topo, OpenFreeMap Outdoor, OpenTopoMap, OSM Outdoors, OpenCycleMap, CyclOSM), обычные карты (Google Map, OpenStreetMap, Google Terrain), спутник (ESRI Satellite, Google Satellite, Bing Satellite, Sentinel-2 cloudless). У кнопки хитмэпа группа — Strava heatmap (all), (run), (ride), (winter).
- У левого нижнего края круга и кнопки хитмэпа — значок меню, как у аватара Telegram. Нажатие открывает слева меню с названиями слоёв группы, слой на карте отмечен. Выбор пункта ставит слой на карту вместо прежнего слоя группы и закрывает меню.
- **BREAKING** Круг отмечен, когда выбрана любая подложка его группы, а не только та, что на картинке. Ни один круг не отмечен только при подложке вне групп: свой слой или снимки по датам. После отката Tracestrack на OpenStreetMap отмечен круг обычной карты.
- Круг и кнопка хитмэпа помнят выбор: нажатие включает слой группы, выбранный последним (в меню, в `All layers` или по ссылке), а без такого — первый слой группы. Память хранится в настройках слоёв и переживает перезагрузку. Откат Tracestrack память не меняет.
- Картинка круга не меняется: превью по типу из `three-quick-bases`. Подсказка и `aria-label` круга и кнопки — название слоя, который включит нажатие.
- В меню нет слоя, который пользователь сам снял в Configure layers, кроме первого слоя группы и слоя на карте. Своих слоёв в меню нет: их тип неизвестен, они остаются в `All layers`.
- **BREAKING** Кнопки отмывки (Relief shading) в столбце больше нет. Отмывка остаётся в `All layers`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `map-layers`: требование «Превью подложек справа» — круг отмечает группу и выбирает подложку из памяти; «Переключатели оверлеев справа» — только кнопка хитмэпа с памятью, без отмывки; новые требования «Меню слоёв столбца» и «Круг помнит выбор типа».

## Impact

- `web/src/layers/quick-layers.ts` (бывший `quick-bases.ts`: группы и память), `web/src/layers/QuickLayers.tsx` (значок и меню), `web/src/layers/LayerSwitcher.tsx` (поле столбца под значок), `web/src/layers/settings.ts` (поле `quickLayers`), `web/src/state/store.ts` (память, действие `setQuickOverlay`), `scripts/layer-thumbnails.mjs` (импорт).
- Тесты: `web/src/layers/LayerSwitcher.browser.test.tsx`, `web/src/layers/ImageryDate.browser.test.tsx`, `web/src/layers/quick-layers.test.ts`, `web/src/layers/settings.test.ts`, `web/src/state/store.test.ts`.
- Документы: `AGENTS.md` («Раскладка»), `docs/architecture/decisions.md`, `openspec/backlog.md` (замена Google Map — первый код группы).
