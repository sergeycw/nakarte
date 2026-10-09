# Proposal

## Why

Новое приложение на `/next/` умеет всё, что владелец решил перенести (changes 1–8 и 6б [списка ресёрча](../../research/new-ui.md#changes-по-порядку)), а на основном адресе `https://nakarte-routing.pages.dev/` по-прежнему старый клиент на Leaflet и knockout, который заморожен и держит за собой webpack, karma с Firefox 52, `src/secrets.js` и отдельные проверки CI. Пора переключить адрес и удалить старый клиент целиком — это change 9 списка.

## What Changes

- **BREAKING** Новое приложение открывается по `/` с OpenStreetMap по умолчанию (подложка — следующим change). Старые ссылки (`m=`, `l=`, `nktk=`, `nktl=`, `nktu=`, `nktp=`, `nktj=`, `r=`, `n2=`, `n=`) открываются на `/` так же, как на `/next/`.
- `/next/` и всё под ним отвечают редиректом на тот же путь от корня (`/next/engine-bench.html` → `/engine-bench.html`), `#` с параметрами переживает редирект. Стенд движка — `/engine-bench.html`.
- Сборка нового приложения — сразу в `build/` вместе с файлами движка, без webpack. `/tiles/`, `/brouter-wasm/`, `functions/` и счётчик `GUARD` не меняются.
- Последняя сессия старого клиента (IndexedDB `sessions`) один раз подхватывается в автосохранение, если у нового приложения ещё нет своего сохранённого списка: треки вкладки и разметка маршрута не пропадают с переключением. Сессии старого клиента не меняются и не удаляются.
- **BREAKING** Удаляется старый клиент: `src/`, `test/` (karma), `webpack/`, `public/`, `eslint_rules/`, конфиги eslint, prettier, stylelint и browserslist, `scripts/build.js`, корневые зависимости клиента и `yarn.lock`, workflow `main.yml` (апстримный `check`) и `check-clone.yml`.
- Линт `workers/` и `functions/` переезжает с eslint на Biome: корневой `biome.json`, корневой `package.json` только с Biome, свой workflow `check-lint.yml`.
- Деплой: без `src/secrets.js`, `sed` ключа Google и `yarnpkg`; ключ Google — только переменная `VITE_GOOGLE_MAPS_API_KEY` шага сборки. Синтетика прода (`scripts/prod-check.sh`) проверяет новое приложение на `/` и редирект `/next/`.
- Подсказка недоступного серверного BRouter в локальном режиме — `docker compose up -d` вместо удалённого `yarn local`.
- Документация: `AGENTS.md` под одно приложение, `docs/architecture/` (`client.md` и `route-editor.md` — заново, связи и реестр решений), `README.md`, правило задач в `openspec/config.yaml`, ссылки ресёрчей и backlog на удалённые файлы — на постоянные ссылки GitHub.
- Не входит (следующий change этой сессии, `retire-old-client-services`): тайлы высот Worker'а высот и их архив в R2, маршрут прокси `/wikimapia/`, порты старых dev-серверов и karma в `ALLOWED_ORIGINS` Worker'ов. Подложка — change 10 (`add-outdoor-basemap`).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-client`: приложение на `/` вместо `/next/`, редирект со старого адреса, старые ссылки клона на `/`; «Полноэкранная карта» и «Адреса сервисов клона» без `/next/` и старого клиента.
- `clone-hosting`: удаляются «Сборка под клон» (`NAKARTE_TARGET`) и «Только Google Street View в панорамах» (список провайдеров старого UI); «Без слоёв на данных автора» и «Без запросов к инфраструктуре автора» — без хоткеев, печати, JNX и сессий.
- `clone-deploy`: удаляются «Сборка из шаблона секретов», «Оба клиента в одном деплое Pages» и «Ключ Google для нового приложения», добавляются «Приложение в корне деплоя Pages» и «Ключ Google только шагу сборки»; «Деплой на каждый push», «Бандл без адресов автора» (без исключений-метаданных старого клиента) и «Секреты только у шагов публикации» — без старого клиента.
- `clone-monitoring`: синтетика проверяет приложение на `/` и редирект `/next/`.
- `tracks`: «Сохранённые сессии старого клиента не трогаются» → последняя сессия подхватывается один раз.
- `routing`: подсказка недоступного серверного BRouter без `yarn local`.
- `route-editing`: требование о ссылке с разметкой заменяется таким же без сценария «Ссылка в старом клиенте».
- `map-layers`: сценарий «Перезагрузка без l=» на `/`.
- `browser-routing-engine`: «Данные движка с того же origin» заменяется «Данные движка от корня origin» со сценарием для `/` и стенда вместо «Страница на /next/».

## Impact

- Код: `web/vite.config.ts`, `web/playwright.config.ts`, `web/vite/engine-files.ts` (копия файлов движка в сборку), `web/public/` (`_redirects`, `favicon.ico`), `web/src/autosave/` (сессия старого клиента), `web/src/routing/router.ts`, тесты и e2e с `/next/`.
- Удаление: `src/`, `test/`, `webpack/`, `public/`, `eslint_rules/`, `.eslintrc.js`, `.prettierrc`, `.stylelintrc`, `.stylelintignore`, `.browserslistrc`, `jsconfig.json`, `CONTRIBUTING.md` автора, `scripts/build.js`, `yarn.lock`; корневой `package.json` — только Biome (npm, `package-lock.json`, `.npmrc`).
- CI: `deploy-pages.yml` (job `pages`, фильтр `changes`), `check-web.yml` (проверка адресов автора по `build/`), удаляются `main.yml` и `check-clone.yml`, новый `check-lint.yml`; `scripts/prod-check.sh`.
- Документы: `AGENTS.md`, `README.md`, `docs/architecture/*`, `openspec/config.yaml`, `openspec/backlog.md`, `openspec/research/*.md`; вне репозитория — `../.claude/launch.json`.
- Cloudflare: только новый деплой Pages; Worker'ы и R2 этот change не трогает. Откат — revert и push.
