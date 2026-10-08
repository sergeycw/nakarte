# Tasks

## 1. Каркас `web/`

- [x] 1.1 `web/package.json`, `.npmrc` (`install-strategy=hoisted`), зависимости стека из design, `package-lock.json` через `npx --yes npm@11 install`; проверка: `npm ci` в чистом каталоге проходит
- [x] 1.2 `tsconfig.json` (strict, алиас `@/*`), `biome.json`, `vite.config.ts` (`base: '/next/'`, `outDir: '../build/next'`, `emptyOutDir`, порт 8769), `index.html` с `<title>nakarte routing</title>`; проверка: `npx biome ci`, `npx tsc --noEmit` и `npm run build` зелёные, в `build/next/index.html` пути начинаются с `/next/`
- [x] 1.3 Tailwind 4 и `shadcn init` (Base UI), компоненты `card` и `toast`; тема только светлая; проверка: `biome ci` и `tsc` зелёные на сгенерированном коде

## 2. Конфиг сервисов

- [x] 2.1 `web/src/config.ts` с `makeConfig(mode)` по образцу `src/config.js` и `config-target/clone.js`; unit-тесты «Сборка клона», «Локальная сборка», нет `nakarte.me`; проверка: `npm test` зелёный

## 3. Карта, панель, тост

- [x] 3.1 `osmStyle(tileUrl)` и полноэкранная `<Map>` с начальным видом из конфига, CSS MapLibre вне слоя после Tailwind, `isolation: isolate`; unit-тест стиля и browser-тест: холст совпадает с контейнером, контролы видны; проверка: `npm test` зелёный
- [x] 3.2 Панель (`Card`) с названием и ссылкой, `<Toaster />`, тост на ошибку тайлов с постоянным id; browser-тесты «Клик по панели» (`elementFromPoint`, карта не сдвигается) и «Сервер тайлов недоступен» (один тост на серию ошибок); проверка: `npm test` зелёный
- [x] 3.3 Playwright e2e против `vite preview` по сценариям `web-client` («Первый заход», «Окно телефона», «Панель на карте», «Сервер тайлов недоступен», «Тёмная тема системы»), тайлы OSM — фикстура, запросы вне `localhost` валят тест; проверка: `npm run e2e` зелёный

## 4. CI, деплой, мониторинг

- [ ] 4.1 `.github/workflows/check-web.yml` по design (действия по SHA, Node 24); проверка: зелёный прогон `check web` на PR
- [ ] 4.2 `deploy-pages.yml`: шаги `web/` в job `pages` после сборки старого клиента и движка, комментарий в job `changes` про `web/`; проверка: после merge прогон `deploy pages` зелёный, `/` — старый клиент, `/next/` — новое приложение
- [ ] 4.3 `scripts/prod-check.sh`: проверка `/next/`; проверка: `sh scripts/prod-check.sh` после деплоя печатает `ok    site next`

## 5. Проверки рисков

- [ ] 5.1 Preflight против CSS MapLibre: стили контролов, атрибуции и холста на живой карте; итог — в design, «Проверки»
- [ ] 5.2 Панели над картой: `z-index` контролов MapLibre против панели и тоста; итог — в design
- [ ] 5.3 Память на мобильной эмуляции (Playwright, профиль телефона): JS-куча и RSS процессов браузера после прокрутки и зума; итог — в design
- [ ] 5.4 `/next/` на проде после деплоя: страница, ассеты, тайлы OSM, консоль без ошибок; итог — в design

## 6. Документы

- [ ] 6.1 `openspec/config.yaml`: правило задач — karma для старого клиента, Vitest и Playwright для `web/`; проверка: `openspec validate --all --strict`
- [ ] 6.2 `AGENTS.md`: `web/` в карте репозитория, запуск, тесты и подвохи; `../.claude/launch.json` — запись `nakarte-web`; проверка: ссылки на файлы и разделы существуют
- [ ] 6.3 `docs/architecture/ci-cd.md`: `check web` в диаграмме и таблице, шаги `pages`, «Сверено по»; `docs/architecture/decisions.md` — запись, если реестр ведёт такие решения; проверка: ссылки существуют

## Workflow follow-up

- PR в `master`, `gh pr checks <N> --watch`, merge.
- Проверка 5.4 после деплоя, итог в design, `/opsx:archive`, коммит архива.
