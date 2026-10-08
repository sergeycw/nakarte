# Proposal

## Why

Причины трёх решений платформы — хостинг на Cloudflare, сервис высот на Rust, монорепо — были записаны только в ресёрче `openspec/research/own-backends.md`. Ресёрч удалён в `554a1fa` (2026-10-08) по правилу «сделанный ресёрч удаляется», и реестр `docs/architecture/decisions.md` стал показывать у этих решений «причина не записана». Аудит системного дизайна (`openspec/research/system-design-audit.md`) нашёл причины в истории git; решение владельца 2026-10-08 — причины решений без своего change хранить в архиве changes, отдельным change только с `design.md`.

## What Changes

- `design.md` этого change записывает причины трёх решений из `git show 554a1fa^:openspec/research/own-backends.md` и их оценку на 2026-10-08.
- Реестр решений ссылается на этот change вместо «причина не записана».
- Кода и требований change не меняет, архивируется с `--skip-specs`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет.

## Impact

- `docs/architecture/decisions.md`: источник у решений «Хостинг на Cloudflare», «Сервис высот на Rust», «Монорепо».
- `openspec/research/system-design-audit.md`: раздел с перенесёнными причинами заменяется ссылкой на архив.
