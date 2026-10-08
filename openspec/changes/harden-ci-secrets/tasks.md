# Tasks

## 1. Workflow

- [ ] 1.1 `deploy-pages.yml`: секреты Cloudflare из `env` job'ов в `env` шагов `wrangler`, `npx --yes $WRANGLER` с `WRANGLER: wrangler@4.148.0`; проверка: `grep` — `secrets.CLOUDFLARE` только в шагах с `$WRANGLER`, прогон `deploy pages` после merge зелёный
- [ ] 1.2 Действия по SHA во всех workflow, кроме `main.yml`; проверка: `grep -n 'uses:'` — только `@<40 hex> # vX.Y.Z` и локальный `./`, все `check-*` и `check clone` зелёные на PR
- [ ] 1.3 `brouter-tiles-sync.yml` и `scripts/brouter-tiles-sync.mjs`: `CLOUDFLARE_TILES_TOKEN || CLOUDFLARE_API_TOKEN`, версия из `WRANGLER`; проверка: `ONLY=E40_N40 node scripts/brouter-tiles-sync.mjs` против локального R2 (без токена) отрабатывает, линт зелёный

## 2. Документация

- [ ] 2.1 `docs/architecture/ci-cd.md`, «Секреты»: какие шаги видят токен, `CLOUDFLARE_TILES_TOKEN`; проверка: ссылки существуют, `openspec validate --all --strict`
