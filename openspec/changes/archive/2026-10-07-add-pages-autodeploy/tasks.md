# Tasks

## 1. Workflow

- [x] 1.1 Написать `.github/workflows/deploy-pages.yml` по шагам ручного деплоя; проверка: `actionlint` без замечаний
- [x] 1.2 Прогнать шаги сборки локально на временном контейнере (`docker create`, `build.sh`, сборка `NAKARTE_TARGET=clone` с шаблоном секретов); проверка: `test -f build/brouter-wasm/lib/brouter.jar && test -f build/brouter-wasm/profiles/lookups.dat`
- [x] 1.3 Проверить шаги wrangler без публикации; проверка: `wrangler pages functions build` компилирует `functions/`, `wrangler deploy --dry-run` в `workers/cors-proxy` проходит

## 2. Запуск в GitHub

- [x] 2.1 Владелец заводит секреты `CLOUDFLARE_API_TOKEN` (Pages Edit, Workers Scripts Edit, Workers R2 Storage Edit) и `CLOUDFLARE_ACCOUNT_ID`; проверка: `gh secret list --repo sergeycw/nakarte` показывает оба
- [x] 2.2 Workflow попадает в `master` форка; проверка: `gh run list --repo sergeycw/nakarte --workflow deploy-pages.yml` показывает успешный прогон
- [x] 2.3 Проверить прод после деплоя; проверка: на `https://nakarte-routing.pages.dev` маршрут в Тбилиси строится, `curl -r 0-0` на `/brouter-wasm/lib/brouter.jar` даёт `206`

## Workflow follow-up

- После 2.3 убрать из `AGENTS.md` пункт про ручной деплой как основной способ, оставить его как запасной.
- Архивировать change: `openspec archive add-pages-autodeploy --yes`.
