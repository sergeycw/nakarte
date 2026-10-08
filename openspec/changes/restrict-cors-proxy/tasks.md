# Tasks

## 1. Worker

- [x] 1.1 `workers/cors-proxy`: только `GET`/`HEAD`/`OPTIONS` без тела, `405` на прочие; `403` на свои адреса; `LAYER_HOSTS` и `OTHER_RATE_LIMITER` (1007, 300 за 60 с) по роли цели; проверка: тесты в `workerd` — `405` на `POST` без запроса к цели, `403` на `nakarte-routing.pages.dev` и `*.nakarte-routing.workers.dev`, `429` у произвольного хоста при живых тайлах слоя и наоборот, preflight без `POST`; `check-cors-proxy.yml` зелёный

## 2. Документация и прод

- [x] 2.1 `docs/architecture/cors-proxy.md`, `protection.md`, строка «Прокси по ролям» в `openspec/research/system-design-audit.md`; проверка: ссылки существуют, `openspec validate --all --strict`
- [ ] 2.2 После деплоя: `scripts/prod-check.sh` и `strava heatmap check` зелёные, `POST` через прокси — `405`, прокси на `nakarte-routing.pages.dev` — `403`; проверка: `curl` с прода, ручной запуск workflow
