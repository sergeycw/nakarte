# Tasks

## 1. Начальный вид

- [x] 1.1 `defaultLocation` и `defaultZoom` — Омало, `m=13` (`web/src/config.ts`); проверка: e2e `web-client.spec.ts` «Первый заход», «Неверный вид в ссылке» и `map-layers.spec.ts` «Первый заход без настроек», «Перезагрузка без l=» зелёные
- [x] 1.2 Полный прогон (browser-тесты с зумом по умолчанию числом — через `config.defaultZoom`); проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Ревью и вид

- [x] 2.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 2.2 Скриншот первого захода (компьютер 1280×800 и `Pixel 7`) владельцу до merge

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` в приватном окне; итог — абзацем «Прод после default-view-omalo» в промпте следующей сессии.
