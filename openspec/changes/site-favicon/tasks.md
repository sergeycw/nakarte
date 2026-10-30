# Tasks

## 1. Иконка

- [x] 1.1 Векторная копия картинки владельца `web/public/favicon.svg`; проверка: сравнение и наложение с оригиналом показаны владельцу
- [x] 1.2 `scripts/favicon.mjs`: `favicon.ico` (16, 32, 48) и `apple-touch-icon.png` (180) из SVG; ссылки в `web/index.html`; проверка: e2e `web-client.spec.ts` «Иконка сайта» зелёный, `npm run lint` из корня зелёный (CI — `check-web.yml`, `check-lint.yml`)
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## 2. Документы

- [x] 2.1 `AGENTS.md` (карта репозитория, `scripts/`); проверка: скрипт ссылок, `openspec validate --all --strict`

## 3. Ревью и вид

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Вкладка браузера с новой иконкой (скриншот) владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, `/favicon.svg` и `/favicon.ico` на проде; итог — абзацем «Прод после site-favicon» в промпте следующей сессии.
