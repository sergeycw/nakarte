# Tasks

## 1. Проверка прода

- [x] 1.1 `scripts/prod-check.sh`: девять проверок только чтением; проверка: на проде все `ok`, с подменённым адресом сервиса — `FAIL` и код выхода 1, `shellcheck` чистый
- [x] 1.2 `.github/workflows/prod-check.yml` (расписание, вручную, `workflow_call`) и job `smoke` в `deploy-pages.yml`; проверка: `actionlint` без новых замечаний
- [x] 1.3 После merge: job `smoke` в прогоне `deploy pages` зелёный, ручной запуск `prod check` зелёный

## 2. Журналы и форк

- [x] 2.1 `[observability] enabled = true` в `wrangler.toml` трёх Worker'ов; проверка: `wrangler deploy --dry-run` без ошибок конфига у `cors-proxy` и `tracks`
- [x] 2.2 После деплоя: `observability` в настройках скриптов Worker'ов (Cloudflare API, `script-settings`) включён
- [x] 2.3 Условие `github.repository == 'sergeycw/nakarte'` у `strava heatmap check`

## 3. Документы

- [x] 3.1 `AGENTS.md`, `docs/architecture/ci-cd.md`, `openspec/backlog.md`; проверка: ссылки целы, `openspec validate --all --strict`
