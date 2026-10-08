# Proposal

## Why

`functions/tiles` (код в `workers/tiles`) и `functions/brouter-wasm` отдают движку CheerpJ тайлы BRouter и файлы движка по Range, но тестов у них нет, хотя правило «Свои бэкенды» в `AGENTS.md` требует тесты у каждого сервиса. Range-контракт CheerpJ (`206` и `Content-Range` на `bytes=0-0`, `416` за концом) проверялся только руками на проде. Переделка P1 из аудита системного дизайна (`openspec/research/system-design-audit.md`, «Переделки»).

## What Changes

- `workers/tiles` получает тестовый стенд по шаблону `workers/tracks`: `package.json`, `package-lock.json`, `.npmrc`, `vitest.config.js`, тесты в `workerd` с локальным R2.
- Тесты `functions/brouter-wasm` лежат там же: функция вызывается напрямую с подставным `ASSETS`.
- Workflow `.github/workflows/check-tiles.yml` с фильтром по `workers/tiles/**` и `functions/**`.
- `workers/tiles` сам отвечает `416` на диапазон за концом тайла: R2 в Cloudflare бросает исключение, а локальный R2 miniflare отдаёт объект, и тест на `416` локально падал. Поведение прода не меняется.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет: требования «Тайлы BRouter на том же origin» и «Range для файлов движка» в `clone-hosting` не меняются, тесты их проверяют.

## Impact

- Новые файлы: `workers/tiles/package.json`, `package-lock.json`, `.npmrc`, `vitest.config.js`, `test/`; `.github/workflows/check-tiles.yml`.
- Изменения: `workers/tiles/src/index.js`; `AGENTS.md` (карта репозитория), `docs/architecture/ci-cd.md`, `openspec/backlog.md`.
