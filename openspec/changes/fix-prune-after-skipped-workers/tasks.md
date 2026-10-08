# Tasks

## 1. Условие `prune`

- [x] 1.1 Пробный workflow на временной ветке: job `skipped` с ложным `if`, job `mid` (needs `skipped`, `if: !cancelled()`), job `old` (needs `mid`, `if: needs.mid.result == 'success'`) и `new` (needs `mid`, `if: !cancelled() && needs.mid.result == 'success'`); проверка: в прогоне `old=skipped`, `new=success`; ветка удалена
- [x] 1.2 `if: ${{ !cancelled() && needs.pages.result == 'success' }}` у `prune` в `deploy-pages.yml` и комментарий, почему нужна функция статуса; проверка: YAML разбирается, `check` в PR зелёный
- [x] 1.3 `docs/architecture/ci-cd.md`: `prune` идёт после каждой успешной публикации Pages, и с пропущенными Worker'ами; проверка: `openspec validate --all --strict`

## 2. Прод

- [ ] 2.1 После merge: прогон `deploy pages` с `prune=success`, в логе `deleted N old deployments`, у проекта `nakarte-routing` один деплой; проверка: `gh run view`, Cloudflare API `pages/projects/nakarte-routing/deployments`

## Workflow follow-up

- Архивировать change отдельным PR после проверки прода.
- Первый прогон с Pages без Worker'ов после фикса: `prune=success` в `gh run view`.
