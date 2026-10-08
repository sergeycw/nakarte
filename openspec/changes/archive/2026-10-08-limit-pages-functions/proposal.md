# Proposal

## Why

Security-аудит (`openspec/research/security-audit.md`, п. 1): Pages Functions `/tiles/` и `/brouter-wasm/` не ограничены ничем. Каждый вызов — запрос Workers ($0.30 за миллион) и у `/tiles/` чтение R2 класса B ($0.36 за миллион): одна машина на 1 000 запросов в секунду — ≈ $1 700 в месяц, это единственная точка входа без потолка. Привязку rate limiting Pages Functions не поддерживают. Вдобавок у проекта 77 старых деплоев, и каждый отвечает по `https://<хеш>.nakarte-routing.pages.dev` со своими функциями (`762b3e5f…/tiles/E40_N40.rd5` — `206`): лимит в новой функции обходится через старый деплой.

## What Changes

- Новый Worker `nakarte-guard` (`workers/guard/`) — только счётчик `[[ratelimits]]` (`namespace_id` 1008, 1 200 за 60 с на IP). Наружу не открыт: `workers_dev = false`, `preview_urls = false`; Pages зовёт его по service binding `GUARD` — такой вызов не тарифицируется как запрос.
- Middleware `functions/tiles/_middleware.js` и `functions/brouter-wasm/_middleware.js`: перед функцией спрашивают `GUARD`, сверх лимита — `429` с `Retry-After: 60`. Без `CF-Connecting-IP`, без привязки (локальный `wrangler pages dev`) или при сбое `GUARD` запрос проходит.
- После деплоя Pages job `prune` удаляет все деплои проекта, кроме текущего (`canonical_deployment`): старые функции без лимита больше не отвечают.
- Деплой: job `guard` с тестами до Pages; проверка `check-guard.yml`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `worker-limits`: новое требование «Частота запросов к Pages Functions».
- `clone-deploy`: новое требование «Только текущий деплой Pages»; «Worker'ы раньше Pages» покрывает и `nakarte-guard` без правки.

## Impact

- Новый каталог `workers/guard/` (по шаблону `workers/tracks`), `functions/*/_middleware.js`, корневой `wrangler.toml` (`[[services]]`), тесты middleware в `workers/tiles/test/`.
- `.github/workflows/`: `deploy-pages.yml` (job `guard`, job `prune`, фильтр путей), новый `check-guard.yml`, `check-tiles.yml` (пути `workers/guard/src/`).
- Откат Pages теперь — новым деплоем (revert и push), а не переключением на старый деплой в дашборде.
- Документация: `docs/architecture/protection.md`, `ci-cd.md`, `README.md` (контейнеры), `AGENTS.md` (карта репозитория, ручной деплой).
