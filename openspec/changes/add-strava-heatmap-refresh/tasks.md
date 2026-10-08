# Tasks

## 1. Обновление кук в прокси

- [x] 1.1 `workers/cors-proxy/src/strava.js`: проверка адреса тайла heatmap, запрос страницы `www.strava.com/maps/global-heatmap` с сессией (ручные редиректы только внутри `www.strava.com`, таймаут), сбор четырёх кук из `getSetCookie()`, срок из `CloudFront-Policy`; проверка — тесты 1.3 зелёные
- [x] 1.2 Кеш в памяти изолята с запасом 30 минут, одно обновление на параллельные запросы (`ctx.waitUntil`), пауза 10 минут после неудачи, сброс при смене сессии, фолбэк на `STRAVA_COOKIES`, журнал только с именами; `src/index.js` берёт куки тайла из модуля и ставит `X-Strava-Cookies`; проверка — тесты 1.3 зелёные
- [x] 1.3 Тесты vitest в `workerd` без сети: заглушка `outboundService` в `vitest.config.js` отдаёт страницу strava.com с `Set-Cookie` по сессии; проверить обновление, кеш, срок, параллельные запросы, неудачу и паузу, редирект за пределы strava.com, фолбэк, `X-Strava-Cookies`, что сессия не уходит на тайлы и куки — в ответ клиенту; проверка — `PATH=/usr/local/bin:$PATH npm test` в `workers/cors-proxy` зелёный, тесты запускает существующий `check-cors-proxy.yml`
- [x] 1.4 Линт: `NODE_ENV=production npx eslint --ext js .` чистый, в том числе без `workers/*/node_modules`

## 2. Скрипт владельца

- [ ] 2.1 `scripts/strava-session-secret.mjs`: читает заголовок `Cookie` из stdin, оставляет куки сессии, локально делает тот же запрос импортом `workers/cors-proxy/src/strava.js` и печатает только имена кук и срок (при неудаче пробует весь заголовок и говорит, помогло ли), затем `wrangler secret put STRAVA_SESSION` (Node ≥ 22) и проверка тайла через прокси с повторами; проверка — `--dry-run` на подставных куках печатает имена без значений, линт чистый

## 3. Документация

- [ ] 3.1 `AGENTS.md` (пункт про Strava heatmap) и `openspec/backlog.md`: секрет `STRAVA_SESSION`, команда владельца, `STRAVA_COOKIES` как запас, что смотреть в журнале; проверка — `openspec validate --all --strict` зелёный

## 4. Выкатка

- [ ] 4.1 PR, зелёный CI (`check cors proxy`, `check`), merge, деплой прокси workflow `deploy pages`; проверка — тайл heatmap через прокси без `STRAVA_SESSION` отвечает как раньше (`STRAVA_COOKIES`)

## Workflow follow-up

- Владелец заводит `STRAVA_SESSION` скриптом из задачи 2.1.
- Проверить тайлы через прокси и слои `Sa`, `Sr`, `Sb` на https://nakarte-routing.pages.dev без `*.nakarte.me` в журнале сети; по журналу Worker'а убедиться, что обновление прошло.
- Архивировать change, дельта переносится в `openspec/specs/cors-proxy`.
