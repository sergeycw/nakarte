# Proposal

## Why

Security-аудит (`openspec/research/security-audit.md`, п. 1) нашёл, что у всех трёх Worker'ов включены Version URL: каждая версия доступна публично по `<версия>-<worker>.nakarte-routing.workers.dev` со своим кодом и своими лимитами. 2026-10-08 версия 52 `nakarte-elevation` (текущая — 59) ответила `200`. Значит, любой новый лимит в коде обходится запросом к старой версии, а лимиты из `limit-elevation-reads` и других changes аудита без этого бессмысленны.

## What Changes

- `preview_urls = false` в `wrangler.toml` трёх Worker'ов: Cloudflare перестаёт маршрутизировать на Version URL и их алиасы; основной адрес `<worker>.nakarte-routing.workers.dev` не меняется.
- Требование в `worker-limits`: Worker доступен только по основному адресу.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `worker-limits`: новое требование «Только основной адрес Worker'а».

## Impact

- Конфиги: `workers/{cors-proxy,tracks,elevation}/wrangler.toml`; деплой — job каждого Worker'а в `deploy-pages.yml`.
- Документация: `docs/architecture/protection.md`.
- Клиент и контракты не меняются.
