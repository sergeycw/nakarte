# Tasks

## 1. cors-proxy: тесты

- [x] 1.1 Тестовый стенд `workers/cors-proxy` по шаблону `workers/tracks` (`package.json`, `package-lock.json`, `.npmrc`, `vitest.config.js` с `outboundService` вместо сети) и тесты текущего поведения: `403` без разрешённого origin, preflight, `404` на чужой путь, проксирование и переписывание `Location`; проверка: `PATH=/usr/local/bin:$PATH npm test` в `workers/cors-proxy` зелёный
- [ ] 1.2 Workflow `.github/workflows/check-cors-proxy.yml` с фильтром `paths:`; проверка: зелёный прогон на PR

## 2. Частота запросов

- [x] 2.1 `nakarte-cors-proxy`: `[[ratelimits]]` (1200 за 60 с) и `429` после проверки origin; проверка: тест в `workerd` с пониженным лимитом — сверх лимита `429` с `Retry-After: 60` и CORS, без `CF-Connecting-IP` лимита нет
- [x] 2.2 `nakarte-tracks`: `[[ratelimits]]` (60 за 60 с) и `429` после проверки origin; проверка: тест в `workerd` по той же схеме, `check-tracks.yml` зелёный
- [x] 2.3 `nakarte-elevation`: ответ `429` и выбор группы (тайлы или API) в `core`, вызов привязок (600 и 60 за 60 с) в `worker`; проверка: cargo-тест `core` на заголовки `429` для обеих групп и `403` раньше лимита, тест в `workerd` — `429` у тайлов не трогает лимит API, `check-elevation.yml` зелёный

## 3. Потолок на вызов

- [x] 3.1 `[limits]` в `wrangler.toml`: elevation — `cpu_ms = 10000`; tracks — `cpu_ms = 500`, `subrequests = 10`; cors-proxy — `cpu_ms = 500`, `subrequests = 50`; проверка: `npx wrangler@4 deploy --dry-run` в каждом каталоге без ошибок конфига, тесты сервисов зелёные

## 4. Документация и прод

- [x] 4.1 `AGENTS.md`: лимиты, где они заданы, как поднять, тесты `cors-proxy`; проверка: линт `NODE_ENV=production npx eslint --ext js .` с `node_modules` сервисов и без, `openspec validate --all --strict`
- [ ] 4.2 После деплоя: обычные запросы к трём Worker'ам на проде дают прежние ответы (`curl` тайла, точки высоты, OPTIONS треков и прокси); проверка: ответы `200`/`204`, а не `429`; «Billable usage» в дашборде — без строки за rate limiting или с нулём

## Workflow follow-up

- Архивировать: `openspec archive add-worker-limits --yes` отдельным PR.
