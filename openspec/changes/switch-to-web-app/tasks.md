# Tasks

## 1. Приложение на `/`

- [x] 1.1 `web/vite.config.ts`: `base: '/'`, `outDir: '../build'`; `playwright.config.ts` и тесты с `/next/` (`share.test.ts`, `sync.test.ts`, `engine-files.test.ts`, e2e «Открыть приложение» и «Стенд движка»); проверка: `npm test` и `npm run build && npm run e2e` зелёные
- [x] 1.2 `engineFiles()` копирует `lib` и `profiles` движка в `<outDir>/brouter-wasm/` в `writeBundle`, без каталогов — предупреждение; unit-тест в `vite/engine-files.test.ts`; проверка: `npm test` зелёный, после `build.sh` в `build/brouter-wasm/lib/brouter.jar` есть
- [x] 1.3 `web/public/_redirects` (`/next`, `/next/*` → `302`) и `favicon.ico`; unit-тест правил; e2e «Ссылка на /next/ с параметрами» и «Стенд по старому адресу» (`route.fulfill` по правилам файла); проверка: `npm test` и e2e зелёные, `wrangler pages dev build` отвечает `302` с `Location` от корня
- [x] 1.4 e2e «Набор реальных старых ссылок» на `/` (фикстура `old-links.txt` и синтетические `j=`, `min=`, `sid=`); проверка: e2e зелёный
- [x] 1.5 Подсказка `docker compose up -d` в `routerDownHint`; unit-тест «Серверный BRouter не запущен»; проверка: `npm test` зелёный

## 2. Сессия старого клиента

- [x] 2.1 `autosave/legacy-session.ts`: перевод `routeMarkup` старой сессии в `SegmentRoute` и треки из `data.tracks`; unit-тесты; проверка: `npm test` зелёный
- [x] 2.2 Чтение последней сессии из IndexedDB `sessions` без создания базы; browser-тест в Chromium; проверка: `npm test` зелёный
- [x] 2.3 Источник `legacy` в `startAutosave`, проп `legacySession` у `App`; unit-тесты подхвата, своей записи и ошибки источника; browser-тест и e2e — сценарии «Сессия старого клиента», «Свой список уже есть», «Несколько сессий старого клиента»; проверка: `npm test` и e2e зелёные

## 3. Удаление старого клиента и линт

- [x] 3.1 Удалить `src/`, `test/`, `webpack/`, `public/`, `eslint_rules/`, `.eslintrc.js`, `.prettierrc`, `.stylelintrc`, `.stylelintignore`, `.browserslistrc`, `jsconfig.json`, `CONTRIBUTING.md`, `scripts/build.js`, `yarn.lock`; проверка: `git grep` по `src/`, `webpack`, `karma`, `yarn` вне архивов не находит живых ссылок
- [x] 3.2 Корневые `package.json` (только Biome) и `package-lock.json`, `biome.json` (линтер, `workers/`, `functions/`, `scripts/*.mjs`); исправить находки линта; `check-lint.yml`; проверка: `npx biome ci` из корня и из `web/` зелёные
- [x] 3.3 `scripts/check-no-author-hosts.mjs` без строк-метаданных старого бандла; проверка: скрипт по `build/` зелёный, по файлу с `https://proxy.nakarte.me/` — красный

## 4. CI и синтетика

- [x] 4.1 `deploy-pages.yml` (job `pages` без старого клиента и `sed`, фильтр `changes`), `check-web.yml` (`../build`), удалить `main.yml` и `check-clone.yml`; проверка: `actionlint` или разбор YAML, шаги job'а `pages` локально по порядку дают `build/` с движком и зелёные e2e
- [ ] 4.2 `scripts/prod-check.sh`: `/` с `<title>nakarte routing</title>`, `/next/` — `3xx` на `/`; проверка: `sh -n`, прогон против прода после деплоя зелёный

## 5. Документы и спеки

- [x] 5.1 `AGENTS.md` под одно приложение, `README.md`, `openspec/config.yaml`; `../.claude/launch.json`
- [x] 5.2 `docs/architecture/client.md` и `route-editor.md` заново, `README.md`, `ci-cd.md`, `decisions.md` и остальные — без старого клиента
- [x] 5.3 Ссылки ресёрчей и backlog на `src/` и `test/` — на постоянные ссылки GitHub (`015be893`); backlog — пункты старого клиента; проверка: скрипт ссылок по `openspec/` (без архивов), `docs/`, `AGENTS.md`, `README.md` — все файлы и разделы существуют
- [x] 5.4 `openspec validate --all --strict`

## 6. Ревью, PR, прод

- [x] 6.1 Независимое ревью диффа субагентом, исправления
- [ ] 6.2 PR в `master`, все проверки `pass` на последнем коммите, merge
- [ ] 6.3 После деплоя: `prod check`, старые ссылки и `/next/#…` на проде, движок на `/`, скриншоты компьютера и Pixel 7; итог — design, «Проверки»
- [ ] 6.4 Archive вторым PR, ссылки после archive, таблица «Changes по порядку» ресёрча
