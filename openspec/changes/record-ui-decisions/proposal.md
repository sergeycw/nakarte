# Proposal

## Why

Аудит системного дизайна (`openspec/research/system-design-audit.md`, «Оценка сейчас и вопросы владельцу») оставил владельцу вопросы по решениям без записанной причины, и от ответов зависит выбор стека нового UI. 2026-10-08 владелец ответил и добавил решения о составе нового UI. Их нужно записать до ресёрча нового UI, чтобы ресёрч начинался с них, а не переспрашивал.

## What Changes

- `design.md` записывает ответы и решения владельца 2026-10-08 о новом UI.
- Реестр `docs/architecture/decisions.md` ссылается на этот change у решений «Клиент на Leaflet + knockout», «Ошибка прокладки даёт прямой отрезок», «Ссылки и экспорт несут только геометрию».
- Кода и требований change не меняет, архивируется с `--skip-specs`. Требования поменяются changes нового UI.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

Нет.

## Impact

- `docs/architecture/decisions.md`, `openspec/research/system-design-audit.md` (вопросы владельцу), `openspec/backlog.md` (пункт «Переписать и обновить UI»).
