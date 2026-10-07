# Proposal

## Why

У Cloudflare нет жёсткого потолка расходов: budget alerts на $3, $8 и $10 только присылают письма. Worker'ы клона открыты в интернет на `*.workers.dev`, и один скрипт, долбящий тайлы высот на лету или прокси, способен за месяц выжечь лимиты Workers Paid; зависший запрос по умолчанию может жечь CPU до 30 секунд. Нужны ограничения на стороне самих Worker'ов, пока трафика почти нет и цифры легко подобрать.

## What Changes

- Потолок CPU и подзапросов на один вызов (`[limits]` в `wrangler.toml`): `nakarte-elevation` — 10 с CPU, подзапросы по умолчанию; `nakarte-tracks` — 500 мс и 10; `nakarte-cors-proxy` — 500 мс и 50.
- Ограничение частоты запросов с одного IP (привязка Workers Rate Limiting, окно 60 с): тайлы высот — 600, API высот — 60, треки — 60, прокси — 1200. Сверх лимита — `429` с `Retry-After` и CORS-заголовками сервиса.
- Тесты `cors-proxy`, которых не было: `vitest` в `workerd` по шаблону `workers/tracks` и workflow `check-cors-proxy.yml`.

## Capabilities

### New Capabilities

- `worker-limits`: защита Worker'ов клона от перерасхода — потолок ресурсов на вызов и частота запросов с одного IP, ответ при превышении.

### Modified Capabilities

Нет: контракты сервисов (`elevation-api`, `elevation-tiles`, `track-storage`, `cors-proxy`) не меняются, `429` описан в `worker-limits`.

## Impact

- Конфиги: `workers/{elevation,tracks,cors-proxy}/wrangler.toml`.
- Код: проверка частоты в `workers/tracks/src/index.js`, `workers/cors-proxy/src/index.js`, `workers/elevation/worker` (Rust, `RateLimiter` из `workers-rs`) и ответ `429` в `workers/elevation/core/src/http.rs`; адаптер `server` (VPS) частоту не ограничивает.
- Тесты и CI: `workers/cors-proxy/` получает `package.json`, `vitest.config.js`, тесты и `check-cors-proxy.yml`; тесты `tracks` и `elevation` — сценарии `429`.
- Деплой: шаги в `deploy-pages.yml` не меняются, привязки уходят из `wrangler.toml`.
