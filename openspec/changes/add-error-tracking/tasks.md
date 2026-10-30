# Tasks

## 1. Ветка

- [x] 1.1 Перенести в ветку change коммиты веток `note-web-analytics` (#175) и `smoke-settle` (#176) cherry-pick'ом, по коммиту на смысл: без них PR не мержатся из-за ruleset `master checks`. Проверка: `git log master..HEAD` показывает оба коммита, `actionlint` на `deploy-pages.yml` и `prod-check.yml` чистый.

## 2. Трекер в приложении

- [x] 2.1 Поставить последнюю мажорную версию `@sentry/react` (`npx --yes npm@11 install`), прочитать её документацию о сборе данных (`dataCollection` в v11 или `sendDefaultPii` в v10) и записать выбор в design. Проверка: `npm ls @sentry/react`, `npm run build` проходит.
- [x] 2.2 Поле `sentryDsn` в `makeConfig` (`web/src/config.ts`) из `VITE_SENTRY_DSN`, пусто без переменной — как `googleMapsApiKey`. Проверка: unit-тест `makeConfig` с DSN и без.
- [x] 2.3 Модуль `web/src/errors/`: `startErrorTracking(dsn)` (пустой DSN — выход без `Sentry.init`), без `BrowserSession`, сбор пользователя, кук, заголовков и тел выключен, `allowUrls` — свой origin; чистые `scrubEvent` (адрес страницы — `origin + pathname`, без заголовков и `query_string`) и `keepBreadcrumb` (только `ui.click` и `ui.input`). Проверка: unit-тесты `scrubEvent` на ссылках из `src/state/fixtures/old-links.txt` и на `m=`, `nktk`, `nktl`, `r=`, `?`, `#` — в результате нет `#`, `?` и координат; `keepBreadcrumb` отбрасывает `fetch`, `xhr`, `navigation`, `console`.
- [x] 2.4 `main.tsx`: `startErrorTracking(config.sentryDsn)` до `createRoot`, `onUncaughtError` и `onRecoverableError` у корня из `Sentry.reactErrorHandler()`. Проверка: unit-тест «Сборка без DSN» (`errors/tracking.test.ts`, SDK подменён) — без DSN `Sentry.init` и `captureException` не вызываются, `fetch` не тронут (design, «Тесты»).
- [x] 2.5 Замерить прирост главного чанка gzip (`npm run build` до и после) и записать в design. Проверка: число в design.

## 3. Отказ движка

- [x] 3.1 `EngineOptions.onBackendError(name, error)`: `startBackends` зовёт его для каждого упавшего бэкенда; синглтон `engine.ts` передаёт отчёт трекера (`captureException` с тегом `engine.backend`, не чаще раза за загрузку страницы на бэкенд); стенд движка — без колбэка. Проверка: unit-тесты в `engine.test.ts` — колбэк вызван для `worker` и `main-thread` при двух отказах, не вызван при успешном запуске и при `route-failed`; unit-тест модуля трекера — второй отказ того же бэкенда не отправляется.

## 4. e2e

- [x] 4.1 Заглушка приёма Sentry в фикстуре `network` (`web/e2e/fixtures.ts`): адреса `*.ingest.sentry.io` и `*.ingest.de.sentry.io` — ответ `200`, конверты сохраняются для теста, в `network.external` не попадают. Проверка: существующие e2e зелёные на сборке с поддельным DSN.
- [x] 4.2 e2e «Ошибка на странице»: ссылка с `m=` и треком, исключение из `page.evaluate` через `setTimeout`; ровно один конверт, в нём адрес без `#` и `?`, нет координат ссылки, адресов запросов и сообщений консоли. «Заход без ошибок»: ссылка с треком и профилем высот — ноль конвертов. Оба пропускаются (`test.skip` с причиной), если в сборке нет DSN. Названия — как сценарии спеки `clone-monitoring`. Проверка: `npm run build` с поддельным DSN и `npm run e2e` зелёные.
- [ ] 4.3 `check-web.yml`: сборка с `VITE_SENTRY_DSN: https://public@o0.ingest.sentry.io/0` (поддельный DSN, не секрет), чтобы сценарии 4.2 шли в CI. Проверка: `actionlint`, зелёный `check web` в PR.

## 5. Деплой

- [x] 5.1 `vite.config.ts`: `build.sourcemap: 'hidden'`. Проверка: после `npm run build` карты есть в `build/assets/`, в `.js` нет `sourceMappingURL`; `node scripts/check-no-author-hosts.mjs build` проходит с картами.
- [x] 5.2 `deploy-pages.yml`, job `pages`: `VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}` только шагу `web build`; после сборки и до e2e — `npx --yes @sentry/cli@<точная версия> sourcemaps inject build` без токена; после e2e — `sourcemaps upload build` с `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` только при заведённом токене; затем всегда удаление `build/**/*.map` и проверка, что их нет, до `wrangler pages deploy`. Проверка: `actionlint`; локально `inject` на сборке и удаление карт отрабатывают; токен не стоит ни у одного шага, кроме загрузки.

## 6. Документы

- [ ] 6.1 `AGENTS.md`: трекер — где модуль, что вырезается, где DSN и секреты, как пропускаются e2e без DSN, подвох с картами и `sentry-cli`; раздел «Публичный клон на Cloudflare» — секреты `SENTRY_*` заводит владелец. Проверка: перечитать абзацы, ссылки на файлы существуют.
- [ ] 6.2 `docs/architecture/`: Sentry — внешний получатель на схеме контейнеров, строка реестра решений со ссылкой на design. `openspec/backlog.md`, «Внешние зависимости и риски»: лимит плана Developer и публичный DSN. Проверка: ссылки и якоря открываются (проверка ссылок, как в прошлых change).

## 7. Проверка

- [ ] 7.1 Полный прогон: `npm test`, `npm run build` с поддельным DSN, `npm run e2e`, `npm run lint` и `npx tsc -b` в `web/`, `openspec validate --all --strict`. Проверка: всё зелёное.

## Workflow follow-up

- Владелец: аккаунт и проект Sentry, Allowed Domains `nakarte-routing.pages.dev`, «Prevent Storing of IP Addresses», секреты `SENTRY_DSN` и `SENTRY_AUTH_TOKEN`, переменные `SENTRY_ORG` и `SENTRY_PROJECT` (design, «Migration Plan»).
- После секретов: ручной `deploy pages`, проверка на проде по шагу 3 «Migration Plan»; результат — в следующий change.
- Архив в том же PR (`/opsx:archive`), закрыть #175 и #176 после мержа.
