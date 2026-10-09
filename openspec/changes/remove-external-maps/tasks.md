# Tasks

## 1. Удаление

- [x] 1.1 `web/src/map/external.ts` и его unit-тест удалены, кнопка и меню — из `MapButtons.tsx`, проп `fetch` у `MapButtons` — из `App.tsx`; browser-тесты меню удалены, добавлен «кнопки внешних карт нет»; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)
- [x] 1.2 Документы: `AGENTS.md`, `docs/architecture/client.md`, `docs/architecture/elevation.md`, ресёрч (п. 5); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## Workflow follow-up

- Archive в том же PR (решение владельца 2026-10-09); ссылки после archive — скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: на `/` нет кнопки внешних карт, `prod check` зелёный; итог записывается в change `polish-web-ui`.
