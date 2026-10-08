# Tasks

## 1. Worker

- [x] 1.1 `workers/tracks`: `WRITE_RATE_LIMITER` (1006, 10 за 60 с) для `POST` после общего счётчика, потолок 2 МиБ, алфавит тела, `customMetadata.created`; проверка: тесты в `workerd` — `413` на 2 МиБ + 1, `400` на тело с пробелом, `429` на запись сверх лимита при живом `GET`, `created` у нового объекта, фикстура клиента проходит; `check-tracks.yml` зелёный

## 2. Документация и прод

- [x] 2.1 `docs/architecture/protection.md`, `docs/architecture/track-storage.md`, реестр `decisions.md` (лимит тела); проверка: ссылки существуют, `openspec validate --all --strict`
- [x] 2.2 После деплоя: `scripts/prod-check.sh` зелёный (`GET` неизвестного ключа — `404`), `POST` с телом вне алфавита — `400`; проверка: `curl` с прода
