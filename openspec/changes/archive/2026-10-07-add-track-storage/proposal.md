# Proposal

## Why

Ссылка «Copy link» (`nktl=`) в клоне сохраняет треки на `tracks.nakarte.me` автора. Направление «полная автономия» (`openspec/research/own-backends.md`) требует своего хранилища; это первый и самый простой сервис, на нём же отрабатывается шаблон для остальных: Worker в `workers/<сервис>/`, R2, тесты в рантайме Workers, отдельный workflow CI, переключение ключом в `config-target`.

## What Changes

- Новый Worker `workers/tracks/`: `POST /track/{key}` сохраняет тело в R2, `GET /track/{key}` отдаёт его. Ключ сверяется с md5 тела, повторная запись того же ключа ничего не меняет, слишком большое тело получает `413`, CORS только для origin клона.
- Тесты Worker в его рантайме и workflow `.github/workflows/check-tracks.yml` с фильтром по `workers/tracks/**`.
- Деплой Worker при push в `master` вместе с остальным клоном.
- `src/config-target/clone.js`: `tracksStorageServer` указывает на свой Worker.
- Обратной совместимости с треками автора нет: старые `nktl=` из хранилища автора в клоне не открываются.

## Capabilities

### New Capabilities

- `track-storage`: хранение треков для коротких ссылок `nktl=` — контракт записи и чтения, проверка ключа, лимит размера, CORS.

### Modified Capabilities

- `clone-hosting`: требование «Авторские бэкенды высот и треков» заменяется требованием только про бэкенд высот; треки клон хранит у себя.

## Impact

- Новые файлы: `workers/tracks/` (код, `wrangler.toml`, `package.json`, тесты), `.github/workflows/check-tracks.yml`.
- Изменения: `src/config-target/clone.js`, `.github/workflows/deploy-pages.yml` (шаг деплоя Worker).
- Cloudflare: новый бакет R2 под треки и Worker на поддомене `nakarte-routing.workers.dev`; создаёт владелец или агент через уже залогиненный wrangler, токены GitHub заводит владелец.
- Клиент nakarte не меняется.
