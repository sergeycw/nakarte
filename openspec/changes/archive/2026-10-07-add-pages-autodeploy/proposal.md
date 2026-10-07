# Proposal

## Why

Клон на `nakarte-routing.pages.dev` сейчас деплоится руками: собрать файлы движка из образа BRouter, собрать сайт, залить Pages и прокси. Шаги легко перепутать (сборка без файлов движка проходит молча), а прод отстаёт от `master`.

## What Changes

- Workflow `.github/workflows/deploy-pages.yml`: на каждый push в `master` форка и вручную собирает файлы движка из образа `ghcr.io/abrensch/brouter:nightly`, собирает сайт с `NAKARTE_TARGET=clone` и `secrets.js.template`, проверяет, что jar и `lookups.dat` попали в сборку, деплоит Pages-проект `nakarte-routing` (вместе с Pages Functions) и worker `nakarte-cors-proxy`.
- Новые деплои отменяют незаконченный предыдущий.
- В GitHub нужны секреты `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`; их заводит владелец репозитория.

## Capabilities

### New Capabilities

- `clone-deploy`: автоматическая публикация клона из `master` форка — что и когда деплоится, какие проверки защищают прод от неполной сборки.

### Modified Capabilities

## Impact

- Новый файл `.github/workflows/deploy-pages.yml`, только в форке.
- Cloudflare: Pages `nakarte-routing`, worker `nakarte-cors-proxy`.
- GitHub: секреты репозитория `sergeycw/nakarte`. Тот же токен нужен синхронизации тайлов (права Pages, Workers Scripts, R2 на запись).
