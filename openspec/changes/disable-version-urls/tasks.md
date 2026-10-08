# Tasks

## 1. Конфиг

- [ ] 1.1 `preview_urls = false` в `wrangler.toml` `nakarte-cors-proxy`, `nakarte-tracks`, `nakarte-elevation`; проверка: `npx wrangler@4 deploy --dry-run` в `workers/cors-proxy` и `workers/tracks` без ошибок конфига, тесты сервисов в CI зелёные

## 2. Документация и прод

- [ ] 2.1 `docs/architecture/protection.md`: Version URL выключены; проверка: ссылки существуют, `openspec validate --all --strict`
- [ ] 2.2 После деплоя: Version URL старой версии каждого Worker'а не отвечает `200`, `scripts/prod-check.sh` зелёный; проверка: `curl` по одной старой версии на Worker, `previews_enabled: false` в Cloudflare API (`workers/scripts/<имя>/subdomain`)
