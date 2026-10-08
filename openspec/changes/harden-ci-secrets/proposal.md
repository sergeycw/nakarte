# Proposal

## Why

Security-аудит (`openspec/research/security-audit.md`, п. 5 и 6): `CLOUDFLARE_API_TOKEN` задан в `env` всего job'а деплоя, поэтому его видят все шаги — установка 1 183 пакетов клиента (`yarnpkg`, 312 известных уязвимостей в dev-зависимостях), `npm ci`, `npm test`, сборочные скрипты `cargo` и стороннее действие `Swatinem/rust-cache`. Действия закреплены тегами, которые автор действия может перезаписать, а `npx --yes wrangler@4` тянет последнюю 4.x на каждом деплое. Утечка токена — деплой любого кода и удаление бакетов, включая невосстановимые треки.

## What Changes

- Секреты Cloudflare — только в `env` шагов, которые зовут `wrangler`; установка зависимостей, тесты и сборка идут без них.
- Действия в своих workflow — по полному SHA с тегом в комментарии. Апстримный `main.yml` не трогаем (секретов в нём нет).
- Точная версия `wrangler` в шагах с токеном: переменная `WRANGLER` workflow, скрипт синхронизации берёт её же.
- Синхронизация тайлов берёт `CLOUDFLARE_TILES_TOKEN`, если владелец его завёл (токен только на запись в `nakarte-tiles`), иначе прежний `CLOUDFLARE_API_TOKEN`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `clone-deploy`: новое требование «Секреты только у шагов публикации».
- `tile-sync`: новое требование «Токен синхронизации».

## Impact

- `.github/workflows/`: все, кроме `main.yml`; `scripts/brouter-tiles-sync.mjs`.
- Документация: `docs/architecture/ci-cd.md` (секреты), `AGENTS.md` не меняется (правила те же, ручной деплой — `npx wrangler@4`).
- Обновление действий и `wrangler` — правкой SHA и `WRANGLER` в workflow.
