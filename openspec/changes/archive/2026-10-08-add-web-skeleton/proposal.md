# Proposal

## Why

Новый фронтенд клона решено писать заново рядом со старым и выкатывать на прод с первого change, по пути `/next/` того же Pages-проекта ([ресёрч](../../../research/new-ui.md), п. 7; архив [record-new-ui-decisions](../2026-10-08-record-new-ui-decisions/design.md)). Прежде чем переносить функции, нужен каркас: стек, тесты и CI, сборка и деплой, одно место адресов сервисов и карта MapLibre под интерфейсом shadcn. Риски ресёрча, которые решают весь план (Preflight Tailwind против CSS MapLibre, слои панелей над картой, память на телефоне, работа `/next/` на проде), дешевле проверить на пустой карте, чем на готовом редакторе.

## What Changes

- Новый каталог `web/` по образцу `workers/<сервис>/`: свои `package.json`, `package-lock.json`, `.npmrc`; React 19, Vite 8, TypeScript 7 strict, Biome, Vitest 5 (unit в Node и browser mode в Chromium через Playwright), Playwright e2e, shadcn/ui на Base UI + Tailwind CSS 4, Zustand.
- `web/src/config.ts` — одно место адресов сервисов (те же Worker'ы, что в `src/config.js`); различия клона и локального серверного режима — через режимы Vite (`--mode clone`).
- Приложение: полноэкранная карта MapLibre GL JS 6 через `@vis.gl/react-maplibre` с растровым OpenStreetMap, одна плавающая панель и тост на компонентах shadcn поверх карты.
- Сборка с `base: '/next/'` в `build/next/`; job `pages` в `deploy-pages.yml` собирает оба клиента и перед публикацией гоняет тесты `web/`, фильтр job'а `changes` учитывает `web/**`.
- Новый workflow `check-web.yml` (`paths: web/**`): Biome, `tsc`, Vitest, сборка, проверка бандла на адреса автора, Playwright.
- `scripts/prod-check.sh` проверяет, что `/next/` отдаёт приложение.
- Правило задач в `openspec/config.yaml` («karma для клиента») расширяется на `web/` с Vitest; `AGENTS.md` — запуск `web/` и подвохи; `docs/architecture/ci-cd.md` — новый workflow.
- Старый клиент (`src/`, `test/`, `webpack/`, `main.yml`) не меняется.

## Capabilities

### New Capabilities

- `web-client`: новое приложение клона — где оно живёт и как открывается, откуда берёт адреса сервисов, что показывает поверх карты. Следующие changes нового UI добавляют сюда свои требования.

### Modified Capabilities

- `clone-deploy`: деплой Pages собирает и публикует оба клиента, тесты нового приложения идут перед публикацией, правка `web/` выкатывает Pages.
- `clone-monitoring`: синтетическая проверка прода проверяет и `/next/`.

## Impact

- Новый код: `web/`, `.github/workflows/check-web.yml`.
- Изменения: `.github/workflows/deploy-pages.yml` (job `changes` и `pages`), `scripts/prod-check.sh`, `openspec/config.yaml`, `AGENTS.md`, `docs/architecture/ci-cd.md`, `../.claude/launch.json` (вне репозитория, запись для dev-сервера `web/`).
- Прод: `https://nakarte-routing.pages.dev/next/` — новое приложение; `/` не меняется. Pages-проект, функции, Worker'ы и секреты те же, новых прав токена не нужно.
- Внешние сервисы: тайлы `tile.openstreetmap.org` — как у старого клиента.
- Время деплоя Pages растёт на установку зависимостей `web/`, Chromium для Playwright и прогон тестов.
