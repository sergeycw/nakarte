# Proposal

## Why

После security-аудита деплойный токен потерял право R2 на весь аккаунт: с ним можно было удалить любой бакет, включая невосстановимые треки. Синхронизация тайлов шла через `wrangler r2 object put` с этим токеном. Право, ограниченное одним бакетом (`Workers R2 Storage Bucket Item Write` на `nakarte-tiles`), REST API объектов R2, в который ходит `wrangler`, не принимает: ручной прогон 2026-10-08 с `only=E40_N40` получил `403 Authentication error` и на чтение `manifest.json`, и на запись. Тот же прогон вскрыл второй дефект: ошибку чтения манифеста скрипт принимает за пустой манифест, и запись после неё затёрла бы версии всех тайлов — следующий прогон перекачал бы ≈ 10 ГБ.

## What Changes

- Синхронизация в Cloudflare идёт через S3 API R2 (`aws s3api get-object`, `aws s3 cp`), как заливка высот, с ключами `R2_ACCESS_KEY_ID` и `R2_SECRET_ACCESS_KEY`. Токен этих ключей («nakarte-elevation data upload») теперь пишет в `nakarte-elevation` и `nakarte-tiles`; `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_TILES_TOKEN` синхронизации не нужны.
- Локальный режим по-прежнему пишет в локальный R2 через `wrangler --local`.
- Манифест считается пустым только при ответе «объекта нет» (`NoSuchKey`); любая другая ошибка чтения останавливает прогон до заливки.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `tile-sync`: «Токен синхронизации» заменяется требованием «Ключи синхронизации»; новое требование «Ошибка чтения манифеста».

## Impact

- `scripts/brouter-tiles-sync.mjs`, `.github/workflows/brouter-tiles-sync.yml`.
- Документация: `docs/architecture/ci-cd.md` (секреты, схема данных), `decisions.md` (загрузка тайлов), `AGENTS.md` (права токена R2), security-аудит (шаг владельца про `CLOUDFLARE_TILES_TOKEN`).
- Multipart `aws s3 cp` снимает и ограничение `wrangler r2 object put` в 315 МБ на объект.
