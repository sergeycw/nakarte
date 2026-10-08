# Proposal

## Why

Job `prune` в `deploy-pages.yml` не запускается, когда Pages выкатываются без Worker'ов, то есть почти на каждом push. В прогонах по merge PR #96, #97 и #99 `pages=success`, Worker'ы `skipped`, `prune=skipped`; запускался он только в прогоне PR #95, где деплоились все Worker'ы. Старые деплои Pages копятся и отвечают по `<хеш>.nakarte-routing.pages.dev` без новых лимитов, а требование «Только текущий деплой Pages» спеки `clone-deploy` не выполняется.

## What Changes

- Условие `prune` дополняется функцией статуса: `!cancelled() && needs.pages.result == 'success'`. Чистка идёт после каждой успешной публикации Pages, какие бы Worker'ы ни выкатывались.
- В требование «Только текущий деплой Pages» добавляется сценарий «Pages без Worker'ов», которого не хватало и из-за отсутствия которого дыра прошла.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `clone-deploy`: требование «Только текущий деплой Pages» — новый сценарий про прогон, где Worker'ы пропущены.

## Impact

- Workflow: `.github/workflows/deploy-pages.yml`, job `prune`.
- Документация: `docs/architecture/ci-cd.md` (абзац про `prune`).
- Первый прогон после фикса удалит все накопившиеся старые деплои Pages.
