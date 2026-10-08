# Proposal

## Why

Слои Strava heatmap держатся на сессии `_strava4_session` из секрета `STRAVA_SESSION`, а её срок неизвестен: в браузере это сессионная кука без `Expires` (проверено владельцем 2026-10-08), страница heatmap её не продлевает (журнал прокси), а куки «запомнить меня», по которой Strava выдаёт новую сессию, нет (`--probe` скрипта). Когда сессия умрёт, слои молча опустеют, пока владелец не заведёт новую. Владелец не хочет ничего обновлять руками. 2026-10-08 найдено, что Strava отдаёт часть heatmap без входа: `heatmap-external-{a,b,c}.strava.com/tiles/…` — до z12 включительно для 256 px и до z11 для 512 px, тайл z12 совпадает с тайлом по сессии байт в байт. Так делает и [canicule](https://github.com/MateoGreil/canicule).

## What Changes

- Тайл heatmap, для которого у прокси нет кук (`none`) или на который CloudFront ответил `401`/`403` (куки протухли), прокси берёт с анонимного адреса, если зум не выше z12 (256 px) или z11 (512 px). Без кук, со своим `User-Agent` клиента.
- Ответ такого тайла несёт `X-Strava-Cookies: anonymous`. Ежедневная проверка по-прежнему требует `session` и пришлёт письмо, когда сессия умрёт.
- Выше z12 без живых кук всё как раньше: ответ CloudFront (`403`) и пустой слой.
- Клиент не меняется: адреса тайлов те же, подмена — в прокси.

## Capabilities

### New Capabilities

### Modified Capabilities

- `cors-proxy`: «Источник кук Strava в ответе тайла» — новое значение `anonymous`; новое требование «Анонимные тайлы heatmap без кук».

## Impact

- `workers/cors-proxy/src/strava.js`, `src/index.js`, тесты и заглушка `vitest.config.js`.
- Внешний сервис: запросы без кук к `heatmap-external-*.strava.com`, когда сессии нет.
- `AGENTS.md` (пункт про Strava heatmap), `openspec/backlog.md`.
