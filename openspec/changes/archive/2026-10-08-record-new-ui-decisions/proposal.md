# Proposal

## Why

Ресёрч нового UI (`openspec/research/new-ui.md`) закончился вопросами владельцу, и от ответов зависит нарезка changes нового приложения. 2026-10-08 владелец ответил на все вопросы, кроме слоя по умолчанию. Ответы нужно записать до первого change, чтобы changes начинались с них, а не переспрашивали; ресёрч потом удаляется, а причины остаются в архиве.

## What Changes

- `design.md` записывает ответы владельца 2026-10-08 и что из них следует для changes нового UI.
- Реестр `docs/architecture/decisions.md` ссылается на этот change у решений о клиенте и о движке в браузере.
- Кода и требований change не меняет, архивируется с `--skip-specs`. Требования поменяются changes нового UI.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет.

## Impact

- `docs/architecture/decisions.md`, `openspec/research/new-ui.md` (вопросы владельцу), `openspec/backlog.md` (пункт «Переписать и обновить UI», новые пункты про слои Яндекса и Oracle Always Free, импорт Strava, Garmin Connect и Wikiloc).
