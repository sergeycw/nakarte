# Tasks

## 1. Синхронизация

- [x] 1.1 `scripts/brouter-tiles-sync.mjs`: удалённый режим через `aws s3api get-object` и `aws s3 cp` с `R2_ENDPOINT` и ключами R2, локальный — `wrangler --local`; пустой манифест только на `NoSuchKey`; проверка: `ONLY=E40_N40 node ../../scripts/brouter-tiles-sync.mjs` из `workers/tiles` в локальный R2 проходит, линт зелёный
- [ ] 1.2 `brouter-tiles-sync.yml`: секреты R2 и `R2_ENDPOINT` вместо токена Cloudflare; проверка: ручной прогон после merge с `only=E40_N40` зелёный, `manifest.json` сохраняет версии остальных тайлов

## 2. Документация

- [x] 2.1 `docs/architecture/ci-cd.md`, `decisions.md`, `AGENTS.md` (права токена R2), шаги владельца в security-аудите; проверка: ссылки существуют, `openspec validate --all --strict`
