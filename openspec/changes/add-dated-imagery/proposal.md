# Proposal

## Why

Владелец 2026-10-12 по ресёрчу [`openspec/research/dated-imagery.md`](../../research/dated-imagery.md#итог) (№ 4 таблицы changes `map-layers.md`): посмотреть снимок района за конкретную дату — например, лежит ли ещё снег на перевале. Мозаика `S2` — годовой композит без облаков и дат не даёт. Снимки HLS (Sentinel-2 и Landsat, приведённые к 30 м) NASA GIBS отдаёт готовыми тайлами по дате, а даты съёмки с облачностью даёт STAC Earth Search; оба сервиса бесплатны, без ключа, браузер ходит в них напрямую.

## What Changes

- **Подложка «Satellite by date»** **[владелец]**: снимки HLS из NASA GIBS за выбранную дату — Sentinel-2 (`S30`) и Landsat 8/9 (`L30`) вместе, 30 м, тайлы до зума 12, выше — растяжение.
- **Код `Hls` в `l=`, дата — `d=ГГГГ-ММ-ДД`** **[агент]**: ни код, ни параметр не заняты старым клиентом; дата пишется в адрес, только пока выбрана эта подложка, и не сохраняется между заходами: через неделю «последний ясный день» другой.
- **Кнопка даты снизу по центру** **[агент]**: пока выбрана подложка, рядом с кнопкой профиля — дата снимка и облачность; по нажатию — список дат за 90 дней над центром карты из Earth Search (облачность, спутник, свежие помечены «may not be ready») и поле «Other date» для любой даты архива.
- **Дата по умолчанию** **[агент]**: без `d=` — самая свежая дата не моложе 3 дней (задержка HLS) с облачностью не больше 20 %, иначе наименее облачная из них; пока даты грузятся или Earth Search недоступен, слой не рисуется, кнопка показывает загрузку или «Dates unavailable» с повтором.
- **Атрибуция** **[агент]**: подпись NASA GIBS дословно из Data Use Guidance, «Contains modified Copernicus Sentinel data <год даты>», «Landsat image courtesy of the U.S. Geological Survey».
- Не в этом change: Sentinel-2 10 м (`spike-sentinel-cog`, только если 30 м мало — решение владельца), MODIS и VIIRS, фильтр облачности по самому месту, сравнение двух дат, проверка GIBS и Earth Search в `prod-check.sh`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `map-layers`: «Каталог слоёв» — подложка `Hls`, в списке 35 слоёв; новые требования «Снимки по датам» (дата в адресе, атрибуция, зум), «Дата снимка по умолчанию» (из Earth Search, недоступность) и «Выбор даты снимка» (список с облачностью, другая дата).

## Impact

- Код: `web/src/layers/catalog.ts` (слой `Hls`, шаблоны GIBS с датой), новый модуль дат `web/src/layers/dated.ts` (Earth Search, выбор по умолчанию, подстановка даты), `web/src/layers/style.ts` (по источнику на слой GIBS), `web/src/layers/ImageryDate.tsx` (кнопка и список), `web/src/map/MapActions.tsx`, `web/src/map/BaseMap.tsx`, стор `web/src/state/store.ts` и адрес `web/src/state/sync.ts`, превью `web/src/layers/thumbnails/Hls.webp` (`scripts/layer-thumbnails.mjs`).
- Сеть: браузер ходит в `gibs.earthdata.nasa.gov` (тайлы) и `earth-search.aws.element84.com` (даты); Worker'ы клона не участвуют.
- Тесты: unit `dated.test.ts`, `catalog.test.ts`, `style.test.ts`, `sync.test.ts`; browser `ImageryDate.browser.test.tsx` (ответ Earth Search — фикстура); e2e — число слоёв и шаблон с датой в `e2e/fixtures.ts`.
- Документы: `AGENTS.md` (абзац «Слои и адрес»), `docs/architecture/` (внешние сервисы, решения), `openspec/research/map-layers.md` и `dated-imagery.md` — ссылки на архив.
