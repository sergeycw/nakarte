# Tasks

## 1. Язык подписей

- [x] 1.1 `tracestrackMap` и `TRACESTRACK_LANGUAGES` в `catalog.ts`, адрес `topo_<язык>`; unit `catalog.test.ts`, browser `App.browser.test.tsx`, e2e — адрес `topo_en`; проверка: тесты зелёные (CI — `check-web.yml`)
- [x] 1.2 Прокси: `TILE_PATH` по списку языков и `topo__`; тесты `workers/cors-proxy/test/tracestrack.test.js`; проверка: `npm test` в `workers/cors-proxy` зелёный (CI — `check-cors-proxy.yml`)
- [x] 1.3 `tracestrack-check.yml` на `topo_en`, документы `docs/architecture/`; проверка: ссылки скриптом
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/`, `npm run lint` в корне зелёные

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (перепроверить список), merge.
- После деплоя: `tracestrack check`, `prod check`, подписи у Казбеги на проде с языком браузера `ru` и `en`; итог — в промпт следующей сессии.
