# Proposal

## Why

Подложка по умолчанию — обычный растровый OpenStreetMap: ни рельефа, ни троп, а владелец хочет туристическую карту, как у MapMagic (пункт backlog «Слой OpenStreetMap по умолчанию — в туристическом стиле»). Открытый вопрос ресёрча ([«Вопросы владельцу»](../../research/new-ui.md#вопросы-владельцу)) закрыт 2026-10-09: владелец выбрал Tracestrack Topo — туристический слой openstreetmap.org, готовый растр с отмывкой, горизонталями и тропами, а не свой векторный стиль на OpenFreeMap. Это change 10 [списка ресёрча](../../research/new-ui.md#changes-по-порядку).

## What Changes

- Новый слой каталога «Tracestrack Topo» (код `Tt`, подложка, группа `Default layers`, первым в списке) с атрибуцией «Maps © Tracestrack» и © OpenStreetMap contributors.
- Подложка по умолчанию — Tracestrack Topo вместо OpenStreetMap. `l=` из адреса (в том числе `l=O` старых ссылок) и сохранённый выбор (`nakarte-web:layers`) по-прежнему важнее умолчания; OpenStreetMap остаётся в каталоге под кодом `O`.
- Тайлы Tracestrack идут только через CORS-прокси клона: ключ API — секрет Worker'а `nakarte-cors-proxy` (`TRACESTRACK_KEY`), в бандл и в ответ клиенту не попадает. Прокси подставляет ключ только в запросы растровых тайлов `topo__`, без ключа отвечает `503` и в Tracestrack не ходит. Хост — в `LAYER_HOSTS` (лимит слоёв 1 200 в минуту).
- Откат: если тайлы Tracestrack Topo не грузятся (нет ключа, квота, сбой сервиса), карта переключается на OpenStreetMap с тостом. Откат действует до перезагрузки и не перезаписывает сохранённый выбор: на следующем заходе приложение снова пробует Tracestrack.
- Новый ежедневный workflow `tracestrack check` (по образцу `strava heatmap check`): тайл Tracestrack через прокси; `503` до ключа — предупреждение, отказ Tracestrack (ключ, квота) — красный прогон и письмо. Синтетика прода (`prod check`) в чужие сайты не ходит и не меняется.
- Шаг владельца: завести ключ Tracestrack и положить его секретом прокси (шаги — design, Migration Plan). До ключа на проде работает откат на OpenStreetMap.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `map-layers`: «Каталог слоёв» — 32 слоя с Tracestrack Topo; «Подложка по умолчанию» — Tracestrack Topo; «Слои через прокси» — с Tracestrack Topo; новое «Откат подложки по умолчанию на OpenStreetMap».
- `web-client`: «Полноэкранная карта OpenStreetMap» становится «Полноэкранная карта» с подложкой по умолчанию; «Тост при ошибке тайлов» — для Tracestrack Topo вместо тоста ошибки — откат.
- `cors-proxy`: новое «Ключ Tracestrack» (ключ только в тайлы `topo__`, `503` без ключа, ключ не уходит клиенту).
- `worker-limits`: «Частота запросов к Worker'ам с одного IP» — тайлы Tracestrack считаются тайлами слоёв.

## Impact

- Код: `web/src/layers/catalog.ts`, `selection.ts`, стор и связь с `localStorage` (`web/src/state/store.ts`, `sync.ts`), обработка ошибки тайлов в `web/src/App.tsx`; тесты unit, browser и e2e, которые считали OpenStreetMap умолчанием.
- Прокси: `workers/cors-proxy/src/index.js`, `vitest.config.js`, тесты; секрет `TRACESTRACK_KEY` заводит владелец (`wrangler secret put`).
- CI: новый `.github/workflows/tracestrack-check.yml`.
- Документы: `AGENTS.md`, `docs/architecture/` (`cors-proxy.md`, `client.md`, `ci-cd.md`, `decisions.md`), `openspec/backlog.md`, ресёрч.
- Квота Tracestrack: бесплатный тариф 100 тыс. тайлов в месяц, только некоммерческое использование; что при превышении — не сказано (риски — design).
