# Tasks

## 1. Правило

- [x] 1.1 `keyless.css`: снять инлайновую инверсию Google вместо второй инверсии корня, комментарий; browser `keyless.browser.test.ts` («Сборка без ключа», «Google не инвертировал панораму», «Сборка с ключом»); проверка: тест зелёный (CI — `check-web.yml`)
- [x] 1.2 Документы: `AGENTS.md`, подвох про `keyless.css`; проверка: ссылки скриптом
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (перепроверить список), merge.
- После деплоя: панорама на проде без ключа в Chromium, WebKit и Firefox — нормальные цвета, водяного знака нет; итог — в промпт следующей сессии.
