# Proposal

## Why

Слои Strava heatmap (`Sa`, `Sr`, `Sb`, `Sw`) работают через прокси с секретом `STRAVA_COOKIES`: подписанные куки CloudFront и `_strava_idcf` живут около суток, и владельцу приходится каждый день копировать их из DevTools и перезаливать секрет. В `openspec/backlog.md` автоматизация обновления стоит первой среди пунктов про Strava. 2026-10-08 найдено, откуда браться свежим кукам: их ставит сам ответ HTML-страницы `https://www.strava.com/maps/global-heatmap` вошедшему пользователю. Значит, прокси может получать их сам, имея только сессию Strava.

## What Changes

- Новый секрет прокси `STRAVA_SESSION` — куки сессии вошедшего аккаунта Strava (`_strava4_session`) в форме заголовка `Cookie`. Заводит владелец новым скриптом `scripts/strava-session-secret.mjs`.
- Прокси сам запрашивает страницу heatmap с этой сессией, берёт из `Set-Cookie` ответа куки `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` и `_strava_idcf` и держит их в памяти изолята до срока из `CloudFront-Policy` с запасом. Параллельные запросы тайлов ждут одно обновление; после неудачи прокси не пытается снова ~10 минут.
- Пока свежих кук нет (сессия не задана, отклонена или Strava ответила не так), прокси, как раньше, подставляет `STRAVA_COOKIES`, если он задан. Скрипт `scripts/strava-heatmap-secret.mjs` остаётся ручным запасным путём.
- Ответ на тайл heatmap несёт `X-Strava-Cookies: session|fallback|none` — откуда взяты куки, без их значений: так скрипт владельца проверяет, что работает именно сессия.
- Ни сессия, ни полученные куки не уходят никуда, кроме двух адресов: сессия — только на `www.strava.com`, куки CloudFront — только на тайлы heatmap. В журнал Worker'а попадают только имена кук и статусы, не значения.

## Capabilities

### New Capabilities

### Modified Capabilities

- `cors-proxy`: «Куки Strava для тайлов heatmap» — источник кук теперь в первую очередь обновление по сессии, `STRAVA_COOKIES` становится запасным; новые требования «Обновление кук Strava по сессии», «Пауза после неудачного обновления», «Сессия Strava не покидает прокси» и «Источник кук Strava в ответе тайла».

## Impact

- `workers/cors-proxy`: новый модуль `src/strava.js`, правка `src/index.js`, тесты и заглушка в `vitest.config.js`. Workflow `check-cors-proxy.yml` уже гоняет тесты сервиса.
- Новый `scripts/strava-session-secret.mjs`; `scripts/strava-heatmap-secret.mjs` остаётся.
- Внешний сервис: прокси раз в сутки на изолят запрашивает страницу `www.strava.com` от имени аккаунта владельца.
- Документация: `AGENTS.md` (пункт про Strava heatmap), `openspec/backlog.md`.
- Клиент не меняется: адреса тайлов и слои те же.
