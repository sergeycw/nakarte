# Proposal

## Why

Слои перевалов Вестры и тайников geocaching.su берут данные с `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/`: автор ежедневно собирает их со westra.ru и geocaching.su. Для автономии клону нужны свои сборщики, выдающие те же файлы (решение владельца — скраперы, а не зеркало файлов автора; `openspec/research/own-backends.md`).

## What Changes

- Скраперы westra.ru и geocaching.su в `workers/scrapers/` на Cron Trigger: раз в сутки собирают данные и кладут в R2 файлы той же схемы, что у автора.
- Раздача файлов по `/westraPasses/<файл>` и `/geocachingSu/<файл>` с CORS и кешированием.
- Проверка условий использования источников до запуска скрапинга.
- Тесты разбора на сохранённых страницах или ответах источников и проверка схемы против фикстур от файлов автора; workflow `.github/workflows/check-scrapers.yml`.
- `westraDataBaseUrl` и `geocachingSuUrl` в `src/config-target/clone.js` на свои адреса.

## Capabilities

### New Capabilities

- `westra-passes-data`: данные перевалов Вестры для слоя перевалов — файлы, схема, частота обновления, раздача.
- `geocaching-su-data`: данные тайников geocaching.su для слоя геокешинга — файл, схема, частота обновления, раздача.

### Modified Capabilities

- `clone-hosting`: клон берёт данные перевалов и геокешинга у себя.

## Impact

- Новые файлы: `workers/scrapers/` (код, `wrangler.toml` с cron, `package.json`, тесты, фикстуры), `.github/workflows/check-scrapers.yml`.
- Изменения: `src/config-target/clone.js`, `.github/workflows/deploy-pages.yml`.
- Внешнее: нагрузка на westra.ru и geocaching.su — раз в сутки, с паузами между запросами.
