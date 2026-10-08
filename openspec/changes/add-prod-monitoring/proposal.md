# Proposal

## Why

Аудит системного дизайна (`openspec/research/system-design-audit.md`, «Наблюдаемость») нашёл: логи Worker'ов видны только вживую через `wrangler tail` (Workers Logs выключены, `observability` у всех трёх не задан), а проверка прода есть только у Strava heatmap. Поломку своего сервиса первым видит пользователь, а причину вчерашней ошибки не найти. Заодно `strava heatmap check` не ограничен форком и в чужом форке падал бы каждый день (backlog, «Сопровождение»).

## What Changes

- Workers Logs у `nakarte-cors-proxy`, `nakarte-tracks`, `nakarte-elevation`: `[observability] enabled = true`.
- `scripts/prod-check.sh` и workflow `prod check`: раз в день и после каждого деплоя (job `smoke` в `deploy pages`) проверяет только чтением сайт, файлы движка, тайл BRouter, API и тайлы высот, хранилище треков и preflight прокси.
- `strava heatmap check` и `prod check` идут только в `sergeycw/nakarte`.

## Capabilities

### New Capabilities

- `clone-monitoring`: синтетическая проверка своих сервисов клона и журналы Worker'ов.

### Modified Capabilities

Нет.

## Impact

- `workers/*/wrangler.toml`, `scripts/prod-check.sh`, `.github/workflows/prod-check.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/strava-heatmap-check.yml`.
- Workers Logs: 20 млн событий в месяц входят в Workers Paid, дальше $0.60 за миллион ([прайс](https://developers.cloudflare.com/workers/platform/pricing/)); за всё время клона было ≈ 16 тыс. запросов.
- Ошибки клиента (Sentry или свой сбор) — не здесь, остаются в backlog.
- `AGENTS.md`, `docs/architecture/ci-cd.md`, `openspec/backlog.md`.
