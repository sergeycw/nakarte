# Proposal

## Why

`deploy pages` на каждый push в `master` выкатывал Pages и все три Worker'а, даже на правку документации. Аудит системного дизайна (`openspec/research/system-design-audit.md`, «Шаблон сервиса: тесты, CI, деплой») нашёл три последствия: Worker с упавшими тестами выкатывается (деплой не ждёт `check-<сервис>`, `master` не защищён); каждый деплой Worker'а — новые изоляты, то есть холодный кеш высот и новое обновление кук Strava; Pages выкатываются раньше Worker'ов, и при смене контракта клиент несколько минут ходит в старый сервис. Проверка бандла на адреса автора шла только в деплое, то есть уже после merge.

## What Changes

- `deploy pages` выкатывает только сервисы, чьи файлы менялись с последнего успешного прогона; ручной запуск — всё.
- Job каждого Worker'а гоняет тесты сервиса перед деплоем; job Pages — тесты Pages Functions.
- Pages выкатываются после Worker'ов и не выкатываются, если деплой Worker'а упал.
- Новый workflow `check clone` на PR: сборка клона и `scripts/check-no-author-hosts.mjs`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `clone-deploy`: деплой изменённых сервисов вместо всего, тесты перед деплоем, порядок Worker'ы → Pages, проверка бандла и на PR.

## Impact

- `.github/workflows/deploy-pages.yml` (переписан на job'ы), новый `.github/workflows/check-clone.yml`.
- `AGENTS.md` (карта репозитория, шаблон сервиса), `docs/architecture/ci-cd.md`, `docs/architecture/decisions.md`, `openspec/backlog.md`.
