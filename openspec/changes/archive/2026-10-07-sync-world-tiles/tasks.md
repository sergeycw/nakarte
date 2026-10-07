# Tasks

## 1. Подготовка

- [x] 1.1 Убедиться, что самый большой тайл пролезает в лимит `wrangler r2 object put` (315 МБ); проверка: максимум в индексе brouter.de — `E5_N45.rd5`, 253 МБ
- [x] 1.2 Секреты `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID` в GitHub и `brouter-tiles-sync.yml` в `master`; проверка: `gh secret list --repo sergeycw/nakarte` и `gh workflow list --repo sergeycw/nakarte` показывают их

## 2. Прогон

- [x] 2.1 Запустить `gh workflow run "brouter tiles sync" --repo sergeycw/nakarte` без `only`; проверка: `gh run view` — прогон успешен, в логе `index: 1142 tiles`
- [x] 2.2 Сверить бакет с индексом brouter.de; проверка: `manifest.json` в бакете содержит запись для каждого тайла индекса

## 3. Проверка на проде

- [x] 3.1 Проложить маршрут вне Грузии на `https://nakarte-routing.pages.dev`; проверка: две точки в Альпах (тайл `E5_N45`) с «Hiking» дают отрезок по тропам, а не прямую

## Workflow follow-up

- Обновить в `AGENTS.md` строку о том, что в R2 только Грузия.
- Архивировать change: `openspec archive sync-world-tiles --yes`.
