# Tasks

## 1. Деплой

- [x] 1.1 `deploy-pages.yml`: job `changes` с базой — последним успешным прогоном, job на каждый Worker с тестами перед `wrangler deploy`, job `pages` после них с тестами Pages Functions; проверка: `actionlint` без замечаний, выбор сервисов на примерах (только docs, только `workers/tracks`, `workers/tiles`, клиент + elevation, workflow) совпадает с design
- [x] 1.2 `check-clone.yml`: сборка клона и `check-no-author-hosts.mjs` на PR; проверка: зелёный прогон на этом PR
- [ ] 1.3 После merge: прогон `deploy pages` выкатывает всё (изменён сам workflow), следующий push только с документами ничего не выкатывает; проверка: список job'ов в прогонах

## 2. Документы

- [x] 2.1 `AGENTS.md`, `docs/architecture/ci-cd.md`, `docs/architecture/decisions.md`, `openspec/backlog.md`; проверка: ссылки целы, `openspec validate --all --strict`
