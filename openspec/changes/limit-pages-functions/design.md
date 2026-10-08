# Design

## Context

Цены и находки — `openspec/research/security-audit.md`, п. 1. Pages Functions [не поддерживают](https://developers.cloudflare.com/pages/functions/bindings/) привязку rate limiting, но поддерживают service bindings, а вызов Worker'а по service binding [не тарифицируется как отдельный запрос](https://developers.cloudflare.com/workers/platform/pricing/#service-bindings) — платится только CPU. Статика Pages бесплатна, пока запрос не вызывает функцию: поэтому корневой `functions/_middleware.js` недопустим — он сделал бы платным каждый запрос к сайту.

## Goals / Non-Goals

**Goals:** у `/tiles/` и `/brouter-wasm/` есть потолок частоты с IP, и обойти его через старый деплой нельзя.

**Non-Goals:**
- Распределённый клиент — как у всех счётчиков по IP.
- Переезд Pages → Worker со статикой (аудит системного дизайна, P3): дал бы привязку прямо в Worker'е, но Range у статики Worker'а не подтверждён.

## Decisions

### Отдельный Worker-счётчик по service binding

Middleware в каталоге каждой функции зовёт `env.GUARD.fetch` с IP клиента в заголовке `X-Client-IP`; `nakarte-guard` тратит `RATE_LIMITER.limit({key: ip})` и отвечает `204` или `429`. `fetch`, а не RPC: Pages Functions описаны с `fetch` по service binding, RPC для Pages в документации не нашлось. Worker закрыт снаружи (`workers_dev = false`, `preview_urls = false`), поэтому заголовок с IP подделать некому. Один счётчик на обе функции: запуск движка читает jar и профили, маршрут — ≈ 40 Range-чтений тайлов, 1 200 в минуту — это десятки маршрутов. Альтернатива — проверка в каждой функции без нового Worker'а — невозможна: привязки нет.

### Fail-open

Без `CF-Connecting-IP`, без привязки `GUARD` (локальный `wrangler pages dev`, тесты) и при ошибке вызова запрос проходит: отказ счётчика не должен ломать прокладку маршрута. Цена — на время сбоя `nakarte-guard` лимита нет.

### `429` для движка

Ответ `429 Too many requests` с `Retry-After: 60`, без CORS (тот же origin). CheerpJ получит ошибку чтения, маршрут упадёт в прямой отрезок с уведомлением (`routing`, «Ошибка прокладки даёт прямой отрезок») — для обычного пользователя недостижимо.

### Удаление старых деплоев

Отдельный job `prune` после `pages`: список деплоев через Pages API (`GET …/deployments`, по страницам), текущий берётся из `canonical_deployment` проекта, остальные удаляются `DELETE …/deployments/{id}?force=true` (`force` — у части деплоев есть алиасы). Если текущий не определился — ничего не удаляется. `curl` + `jq`, а не `wrangler pages deployment delete`: команда может спросить подтверждение, а неинтерактивный запуск это не проверить без удаления. Отдельный job, чтобы сбой чистки не помечал деплой упавшим и не блокировал `smoke`. Откат Pages после этого — revert и push (≈ 5 минут), а не выбор старого деплоя в дашборде. Первый прогон удалит ≈ 77 деплоев.

### Деплой и проверки

`nakarte-guard` — job в `deploy-pages.yml` по шаблону остальных Worker'ов (тесты → `wrangler deploy`), `pages` ждёт его: привязка `GUARD` должна указывать на существующий Worker. Фильтр `changes` получает `guard`; middleware живут в `functions/` и выкатываются с Pages. Тесты: `workers/guard` — `vitest` в `workerd` с пониженным лимитом (`check-guard.yml`); middleware — в `workers/tiles/test/` рядом с тестами функций, с заглушкой `GUARD`; `check-tiles.yml` смотрит и на `workers/guard/src/`, откуда middleware берут общий код.

## Risks / Trade-offs

- [Первый деплой: Pages с привязкой на ещё не созданный Worker] → `pages` идёт после `guard`; если `guard` упал — Pages не выкатывается (как с остальными Worker'ами).
- [Сужение токена] → создание нового Worker'а требует прав на весь продукт Workers; сужать токен до поштучных Worker'ов — после первого деплоя `nakarte-guard` (шаги владельца в аудите).
- [Пользователь за NAT с большим числом маршрутов] → 1 200 в минуту — это ≈ 30 маршрутов в минуту на всех за одним IP.
