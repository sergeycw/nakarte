# Tasks

## 1. Сообщение об ошибке

- [x] 1.1 В `src/lib/brouter/index.js` переводить «datafile <имя>.rd5 not found» в «no routing data for this area» для серверного и браузерного движка; проверка: `NODE_ENV=production npx eslint src/lib/brouter/index.js`
- [x] 1.2 Проверить в браузере на локальном dev-сервере: отрезок в районе без тайла даёт прямую и уведомление «Routing failed: no routing data for this area», а маршрут в Тбилиси строится
- [x] 1.3 Убрать пункт из `openspec/backlog.md`; проверка: `openspec validate --all --strict`

## Workflow follow-up

- Архивировать change: `openspec archive explain-missing-routing-data --yes`.
