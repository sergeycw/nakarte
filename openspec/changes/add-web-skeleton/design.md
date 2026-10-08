# Design

## Context

Стек, UI-библиотека, карта и план перехода выбраны в [ресёрче](../../research/new-ui.md) (п. 1–3, 7) и в архивах [record-ui-decisions](../archive/2026-10-08-record-ui-decisions/design.md) и [record-new-ui-decisions](../archive/2026-10-08-record-new-ui-decisions/design.md); здесь — как это собрать. Версии на 2026-10-08 по `npm view`: `react` 19.3.0, `vite` 8.3.4, `@vitejs/plugin-react` 6.1.2, `typescript` 7.0.2, `vitest` и `@vitest/browser-playwright` 5.0.3, `@biomejs/biome` 2.5.15, `@playwright/test` 1.64.0, `maplibre-gl` 6.13.0, `@vis.gl/react-maplibre` 8.1.3 (peer `maplibre-gl >=4`), `tailwindcss` 4.3.3, `shadcn` 4.21.4, `@base-ui/react` 1.8.0, `zustand` 5.0.15.

Ограничения окружения:
- Старый клиент собирается webpack'ом с `CleanWebpackPlugin` в `build/` ([webpack.config.js](../../../webpack/webpack.config.js)): новое приложение собирается в `build/next/` только после него, иначе каталог сотрут.
- Vitest 5 требует Node `^22.12 || ^24 || >=26`; локально по умолчанию Node 20, Node 22 — в `/usr/local/bin` (`AGENTS.md`, «Подвохи тестового стенда Workers»).
- Job `changes` в [deploy-pages.yml](../../../.github/workflows/deploy-pages.yml) решает про Pages списком исключений (`workers/<сервис>/`, `docs/`, `openspec/`, `test/`, `.github/`, `*.md`), поэтому `web/**` уже включает Pages. Правка фильтра не нужна, нужен комментарий.
- shadcn на Base UI с 2026-07 — выбор по умолчанию у `shadcn init` ([changelog](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)); его тост построен на Base UI Toast, API `toast.add({title})` и `<Toaster />` ([docs](https://ui.shadcn.com/docs/components/base/toast)).

## Goals / Non-Goals

**Goals:**
- Каркас, в который следующие changes добавляют функции без переделки сборки, тестов и деплоя.
- Ответы на риски ресёрча, записанные ниже в «Проверки»: Preflight против CSS MapLibre, слои панелей над картой, память на мобильной эмуляции, `/next/` на проде.

**Non-Goals:**
- Движок CheerpJ и проверка `/app/` CheerpJ со страницы `/next/` — change 2 (`spike-engine-in-worker`): без движка проверять нечего.
- Разбор адреса (`hash.ts`), слои, треки — changes 3–4.
- React Compiler: в plugin-react 6 путь через Oxc помечен experimental (ресёрч, п. 1).

## Decisions

Решений, которых нет в ресёрче и архивах, четыре; владелец подтвердил их 2026-10-08: содержание панели и тост на ошибку тайлов, Zustand с change 3, проверка `/app/` CheerpJ в change 2, e2e перед публикацией Pages вместе с проверкой `/next/` в `prod-check.sh`.

### Каталог `web/` по образцу `workers/tracks`

Свои `package.json` (`"type": "module"`, `engines.node >=22.12`), `package-lock.json` и `.npmrc` с `install-strategy=hoisted` — тот же подвох глобального `~/.npmrc`, что у Worker'ов. Lock-файл ставится `npx --yes npm@11 install` (подвох npm 10 с циклом peer-зависимостей). Конфиги рядом: `biome.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `components.json` shadcn. Альтернатива — workspaces в корневом `package.json` — отвергнута: корень принадлежит старому клиенту на yarn, а с его удалением придётся всё переносить.

### Сборка: `base: '/next/'`, `outDir: '../build/next'`

`emptyOutDir: true` явно: Vite не чистит каталог вне корня проекта без этого флага. Порядок в деплое: старый клиент → движок → новое приложение. Dev-сервер тоже открывается на `/next/`, чтобы относительные пути вели себя как на проде.

### Конфиг: функция от режима Vite, а не `.env`-файлы

`web/src/config.ts` экспортирует `makeConfig(mode)` и `config = makeConfig(import.meta.env.MODE)`. Значения — как в [src/config.js](../../../src/config.js) и [config-target/clone.js](../../../src/config-target/clone.js): прокси, треки, высоты, `routingEngine`/`routingTilesPath`/`routingServer`, начальный вид. Режим `clone` (`vite build --mode clone`, скрипт `build`) включает движок в браузере, остальные — серверный BRouter. Почему не `.env.clone` с `VITE_*`: значения — строки без типов и живут в двух файлах, а различие — два поля. `VITE_*` понадобятся для секретов (ключ Google — change 8). Функция от режима проверяется unit-тестом в Node без сборки.

### Карта: inline-стиль с одним растровым источником

`@vis.gl/react-maplibre` `<Map>` со стилем-объектом: источник `raster` `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `tileSize: 256`, `maxzoom: 19`, атрибуция `© OpenStreetMap contributors`. Стиль собирает функция `osmStyle(tileUrl)`, чтобы тесты подставляли локальный тайл-фикстуру. Ошибку тайла ловит событие карты `error` с `sourceId`: тост `Map tiles failed to load` с постоянным id, повторные ошибки не плодят тосты, пока он виден.

### Стили: Tailwind 4 + CSS MapLibre вне слоя

`index.css`: `@import "tailwindcss"`, тема shadcn (CSS-переменные только для светлой темы, `color-scheme: light`, блока `.dark` нет), затем `maplibre-gl/dist/maplibre-gl.css` без `layer()`. Preflight лежит в `@layer base`, а неслоёные правила побеждают слоёные при любой специфичности ([MDN `@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)), так что там, где MapLibre задаёт свойство, выигрывает MapLibre. Остаются свойства Preflight, которые MapLibre не задаёт (`img, svg, canvas { display: block }`, `img { max-width: 100%; height: auto }`) — проверка ниже.

### Слои над картой: `isolation: isolate` у карты

Контейнер карты получает `isolation: isolate` и свой контекст наложения, поэтому `z-index` контролов MapLibre не выходит наружу; панель и тост — соседи контейнера с `z-index` выше. Base UI своих `z-index` не задаёт (ресёрч, п. 2).

### Панель и тост

Панель — shadcn `Card` в левом верхнем углу: `nakarte routing` и ссылка на GitHub (подпись старого клиента, `caption` в `src/config.js`). Тост — shadcn `toast` на Base UI, `<Toaster />` в корне приложения.

### Zustand — с первым общим состоянием

В каркасе нет состояния, которое делят компоненты: вид карты держит MapLibre, тост — менеджер Base UI. Пакет ставится в change 3 вместе с `hash.ts` и выбором слоя, чтобы не держать неиспользуемую зависимость.

### Тесты

- **Unit (Node)** — `*.test.ts`: `makeConfig` по режимам, отсутствие `nakarte.me`, `osmStyle`.
- **Browser mode (Chromium через `@vitest/browser-playwright`)** — `*.browser.test.tsx`, `vitest-browser-react`: настоящая карта MapLibre с тайлом из фикстуры, холст совпадает с контейнером, `elementFromPoint` в панели даёт панель, клик по панели не двигает карту, контролы видны, тост один на серию ошибок тайлов.
- **e2e (Playwright против `vite preview`)** — сценарии спеки `web-client` с теми же названиями: `/next/`, тайлы OSM подменены фикстурой через `page.route`, всё вне `localhost` блокируется и считается провалом теста, окно 390×844 без прокрутки, тёмная тема системы → светлая.
- Две части Vitest — `test.projects` одного `vitest.config.ts`; `npm test` гоняет обе.

### CI и деплой

- `check-web.yml` (`push` в `master` и `pull_request` с `paths: web/**` и сам workflow): Node 24, `npm ci`, `npx playwright install --with-deps chromium`, `npx biome ci`, `npx tsc --noEmit`, `npm test`, `npm run build`, `node ../scripts/check-no-author-hosts.mjs ../build/next`, `npm run e2e`. Действия закреплены SHA, как в остальных workflow.
- `deploy-pages.yml`, job `pages`: после сборки старого клиента и файлов движка — `npm ci`, Chromium, `npm test`, `npm run build`, `npm run e2e` в `web/`; общая проверка адресов автора уже обходит весь `build/`, включая `build/next/`. Секретов эти шаги не получают.
- `scripts/prod-check.sh`: `GET /next/` → `200` и `<title>nakarte routing</title>`.

### Локальный запуск

`npm run dev` из `web/` на порту 8769 (8765–8768 заняты, 8787–8789 — Worker'ы), запись `nakarte-web` в `../.claude/launch.json`. Для `npm test`, `npm run e2e` и `tsc` — `PATH=/usr/local/bin:$PATH`.

## Проверки

Заполняется при apply.

### Preflight Tailwind против CSS MapLibre

### Панели над картой

### Память на мобильной эмуляции

### `/next/` на проде

## Risks / Trade-offs

- [Деплой Pages дольше: зависимости `web/`, Chromium, тесты] → цена гарантии «тесты перед публикацией»; кешировать браузеры Playwright его документация не советует.
- [TypeScript 7 без программного API] → инструментам, которым API нужен, — `@typescript/typescript6` (ресёрч, п. 1); Biome и Vite типы не читают.
- [Тайлы `tile.openstreetmap.org` без ключа, с политикой использования OSMF] → так же ходит старый клиент; подложка меняется в change 10.
- [Эмуляция телефона в Chromium не ограничивает память как телефон] → замер даёт порядок и разницу «карта без движка»; на живом телефоне — при первой возможности, записать в backlog, если упрёмся.

## Migration Plan

1. PR с `web/`, `check-web.yml` и правкой деплоя; на PR зелёные `check web` и `check clone`.
2. Merge → `deploy pages` выкатывает Pages с обоими клиентами, job `smoke` проверяет `/next/`.
3. Откат — revert и push (старых деплоев Pages нет, job `prune`).
