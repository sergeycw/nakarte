# Tasks

## 1. Счётчик

- [ ] 1.1 `workers/guard` по шаблону `workers/tracks` (`package.json`, `package-lock.json`, `.npmrc`, `vitest.config.js`): `fetch` тратит `RATE_LIMITER` (1008, 1 200 за 60 с) по `X-Client-IP`, `204`/`429`; `workers_dev = false`, `preview_urls = false`; проверка: `vitest` в `workerd` — `429` после лимита, без IP — `204`; `check-guard.yml` зелёный
- [ ] 1.2 `functions/tiles/_middleware.js`, `functions/brouter-wasm/_middleware.js` и общий код в `workers/guard/src/client.js`; `[[services]] GUARD` в корневом `wrangler.toml`; проверка: тесты в `workers/tiles/test/` — `429` без вызова функции, проход при `204`, без IP, без привязки и при ошибке привязки; `check-tiles.yml` (пути и `workers/guard/src/`) зелёный, `npx wrangler@4 pages functions build` собирает функции

## 2. Деплой

- [ ] 2.1 `deploy-pages.yml`: `guard` в `changes`, job `guard` до `pages`, job `prune` после `pages` (Pages API: `canonical_deployment`, удаление остальных с `force=true`); проверка: прогон после merge — `guard`, `pages`, `prune` зелёные, у проекта один деплой

## 3. Документация и прод

- [ ] 3.1 `docs/architecture/protection.md`, `ci-cd.md`, `README.md`; `AGENTS.md` — карта репозитория и ручной деплой (скилл `writing-for-agents`, раздел Pruning); проверка: ссылки существуют, `openspec validate --all --strict`
- [ ] 3.2 После деплоя: `scripts/prod-check.sh` зелёный, старый деплой `762b3e5f.nakarte-routing.pages.dev` не отдаёт тайл, `nakarte-guard` без адреса `workers.dev`; проверка: `curl` с прода, Cloudflare API (только чтение)
