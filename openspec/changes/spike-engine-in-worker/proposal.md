# Proposal

## Why

Движок прокладки в клоне остаётся CheerpJ в браузере ([ресёрч](../../research/new-ui.md), п. 4), но в старом клиенте он считает маршрут на главном потоке и подвешивает карту на время расчёта. CheerpJ с 3.0rc2 запускается в Web Worker через `importScripts`; работает ли там наш `cheerpjRunLibrary` с `/app/`, один ли library-поток на воркер, читается ли `/app/` со страницы `/next/` и сколько весит вкладка с картой и движком — не проверено. Ответ нужен до редактора маршрута (change 5): от него зависит, как новое приложение вызывает движок.

## What Changes

- Спайк с замерами: CheerpJ 4.3 в классическом Web Worker, `/app/` с Range из воркера и со страницы `/next/`, library-поток на воркер, холодный старт, блокировка главного потока при маршруте (MessageChannel-пинг) в воркере против главного потока, память вкладки с картой и движком на мобильной эмуляции. Итоги — в `design.md`.
- Модуль `web/src/engine/`: `engine.ts` — синглтон вне React с очередью запросов и отменой через `AbortSignal`, компоненты получают только промисы; движок в воркере, запасной путь — на главном потоке; рантайм не грузится, пока движок никто не позвал.
- Стенд замеров `web/engine-bench.html` — тот же движок, параметры в адресе, итог в JSON.
- Dev-сервер и `vite preview` нового приложения отдают файлы движка: `/brouter-wasm/` с Range и `206` из `experiments/wasm/cheerpj/` и `brouter/segments4/`, `/tiles/` — прокси на `nakarte-tiles-worker` (8788).
- Тесты без сети: очередь, отмена, ошибки, запасной путь и синглтон — unit с подменённым бэкендом; протокол воркера — browser mode с поддельным воркером; Range dev-сервера — unit; e2e — рантайм не грузится при открытии приложения. Настоящий движок проверяется вручную и на проде.
- `AGENTS.md` — подвохи движка в воркере и запуск стенда; `docs/architecture/routing.md` — движок нового приложения в воркере.
- Старый клиент и его движок (`src/lib/brouter/browser-engine.js`) не меняются.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `browser-routing-engine`: новое приложение считает маршрут вне главного потока с запасным путём на главном; очередь допускает отмену запроса; данные движка читаются с корня origin и со страницы `/next/`.

## Impact

- Новый код: `web/src/engine/`, `web/src/bench/`, `web/engine-bench.html`, `web/vite/engine-files.ts`.
- Изменения: `web/vite.config.ts` (плагин, прокси, вход стенда), `web/vitest.config.ts`, `web/tsconfig.node.json`, `web/src/config.ts` (адрес загрузчика CheerpJ), `web/e2e/`, `AGENTS.md`, `docs/architecture/routing.md`.
- Прод: `/next/` не меняется для пользователя — приложение движок пока не вызывает; стенд — по `/next/engine-bench.html`. Pages Functions, Worker'ы, CI-workflow и секреты те же.
- Внешние сервисы: рантайм CheerpJ с `cjrtnc.leaningtech.com` грузится только со стенда.
