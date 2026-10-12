# Proposal

## Why

Владелец 2026-10-12: в Грузии подложка по умолчанию подписывает населённые пункты грузинским письмом — нужен перевод, если нет английского. Подписи растровых тайлов впечатаны в картинку, менять их может только провайдер. Tracestrack Topo умеет язык подписей именем карты в адресе тайла; владелец выбрал вариант «язык браузера, иначе английский» (`auto-en`) [владелец].

## What Changes

- **Подписи Tracestrack Topo на языке браузера или английские** [владелец]: адрес тайла `topo_<язык>` вместо `topo__` (без перевода). Языки — список карт Tracestrack ([документация](https://tracestrack.com/docs/)): `ar`, `de`, `en`, `es`, `fi`, `fr`, `hu`, `he`, `it`, `ja`, `ko`, `nl`, `uk`, `pl`, `pt`, `ru`, `th`, `sv`, `tr`, `zh-hans`, `zh-hant`; языка браузера нет в списке — `topo_en`.
- **Язык выбирает приложение, а не `auto-en` Tracestrack** **[агент]**: `auto-en` берёт язык из `Accept-Language`, а кеши (браузер, прокси) хранят тайл по адресу — язык одного пользователя достался бы другому. Поведение то же, язык — в адресе.
- **Прокси подставляет ключ в тайлы `topo_<язык>` из того же списка** **[агент]** и в `topo__` (вкладки, открытые до выката); другой язык — без ключа, как прочие адреса Tracestrack. Квота — тот же один кредит за тайл.
- Не в этом change: свой векторный стиль с `name:en` (backlog), подписи других растровых слоёв (OSM, OpenTopoMap, CyclOSM — только местные).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `map-layers`: «Слои через прокси» — адрес `topo_<язык>`; новое требование «Язык подписей Tracestrack».
- `cors-proxy`: «Ключ Tracestrack» — пути `topo_<язык>` из списка Tracestrack и `topo__`.

## Impact

- Код: `web/src/layers/catalog.ts` (`tracestrackMap`, `TRACESTRACK_LANGUAGES`), `workers/cors-proxy/src/tracestrack.js` (`TILE_PATH`).
- Тесты: unit `catalog.test.ts`, browser `App.browser.test.tsx`, e2e `map-layers.spec.ts` и `web-client.spec.ts` — адрес `topo_en`; тесты Worker'а `workers/cors-proxy/test/tracestrack.test.js`.
- CI: `.github/workflows/tracestrack-check.yml` — проверяет `topo_en`. Деплой: Worker прокси выкатывается до Pages (`deploy-pages.yml`), иначе новые адреса тайлов ушли бы без ключа.
- Документы: `docs/architecture/README.md`, `cors-proxy.md`, `decisions.md`.
