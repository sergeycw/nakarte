# Tasks

## 1. Файлы движка в dev-сервере

- [x] 1.1 `web/vite/engine-files.ts`: middleware с Range для `/brouter-wasm/` (каталоги — параметр, по умолчанию `experiments/wasm/cheerpj/` и `brouter/segments4/`), пустой `storageconfig.txt`, плагин для `vite` и `vite preview`; прокси `/tiles/` на 8788 в `vite.config.ts`; `vite/` в `tsconfig.node.json` и в unit-проекте Vitest; unit-тест `engine-files.test.ts` (Range `206`, суффикс, `416`, без Range — `200`, выход за каталог — `404`, `storageconfig.txt`) на временном каталоге; проверка: `npm test` зелёный

## 2. Модуль движка

- [x] 2.1 `web/src/engine/`: `protocol.d.ts`, `cheerpj-router.ts` (пути движка, `loadRouter` для главного потока без повторного `cheerpjInit`), `engine.worker.ts` (классический, без импортов), `backends.ts` (`workerBackend` с фабрикой воркера, `mainThreadBackend`), `engine.ts` (`createEngine`, `getEngine`, `startEngine`, `routeInEngine`, `status`, `subscribe`); `routingEngineRuntimeUrl` в `web/src/config.ts` и в `config.test.ts`; проверка: `npm run typecheck` и `npx biome ci` зелёные
- [x] 2.2 Unit-тест `engine.test.ts` с поддельными бэкендами по сценариям спеки: «Быстрые клики», «Отмена запроса в очереди», «Отмена во время расчёта», «Повторный выбор активности», «Сбой запуска», «Движок вне главного потока не запустился»; импорт `engine.ts` не создаёт бэкенд; проверка: `npm test` зелёный
- [x] 2.3 Browser-тест `backends.browser.test.ts`: `workerBackend` против поддельного воркера — старт, маршрут, ошибка маршрута, `start-failed`, падение воркера отклоняет ожидающие запросы; `include` browser-проекта — `*.browser.test.{ts,tsx}`; проверка: `npm test` зелёный

## 3. Стенд и e2e

- [x] 3.1 `web/engine-bench.html` и `web/src/bench/engine-bench.ts` (MessageChannel-пинг, `backend`, `q`, `runs`, итог в `window.__bench`), второй вход сборки в `vite.config.ts`; проверка: `npm run build` кладёт `build/next/engine-bench.html`, `check-no-author-hosts` по `build/next` зелёный
- [x] 3.2 e2e «Прокладка выключена»: `/next/` не запрашивает `cjrtnc.leaningtech.com`, `/brouter-wasm/`, `/tiles/`; проверка: `npm run e2e` зелёный

## 4. Проверки спайка

- [x] 4.1 CheerpJ в классическом воркере, `/app/` из воркера и со страницы `/next/`, library-поток на воркер, сборка воркера в dev и production; итог — в design, «Проверки»
- [x] 4.2 Холодный старт и блокировка главного потока, воркер против главного потока; итог — в design
- [x] 4.3 Память вкладки с картой и движком на эмуляции Pixel 7; итог — в design
- [ ] 4.4 После деплоя: стенд на `https://nakarte-routing.pages.dev/next/engine-bench.html` в воркере и на главном потоке — маршрут по `/tiles/` и `/brouter-wasm/` через Pages Functions, блокировка; итог — в design

## 5. Документы

- [x] 5.1 `AGENTS.md`: движок нового приложения, стенд, подвохи воркера (классический воркер без импортов, library-поток на глобальную область, `/app/` — корень origin, `phys_footprint` вместо RSS); проверка: ссылки на файлы и разделы существуют
- [x] 5.2 `docs/architecture/routing.md`: движок нового приложения в воркере с запасным путём; `openspec/backlog.md`: параллельный расчёт несколькими воркерами; проверка: ссылки существуют, `openspec validate --all --strict`

## Workflow follow-up

- PR в `master`, `gh pr checks <N> --watch`, merge.
- Проверка 4.4 после деплоя, итог в design, `/opsx:archive`, архив вторым PR.
