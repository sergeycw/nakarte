# Tasks

## 1. Таймаут

- [x] 1.1 `engine.ts`: таймаут `routeTimeout` (по умолчанию 60 с) вокруг `backend.route` в очереди, `EngineTimeoutError`; воркер — `dispose`, сброс бэкенда и запуска, статус `idle`; главный поток — зависший движок, `failed`, отказ `EngineStartError` очереди и новым; unit `engine.test.ts` («Движок не ответил вовремя», «Очередь за зависшим расчётом», «Завис движок на главном потоке»); проверка: тест зелёный (CI — `check-web.yml`)
- [x] 1.2 Unit `router.test.ts`: таймаут — ошибка отрезка, роутер жив; зависание на главном потоке — роутер недоступен; проверка: тест зелёный
- [x] 1.3 Документы: `openspec/backlog.md` — пункт про таймаут убран, `docs/architecture/routing.md` — таймаут и перезапуск в абзаце про движок; проверка: ссылки скриптом
- [x] 1.4 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## 2. Ревью и прод

- [x] 2.1 Независимое ревью диффа субагентом, исправления; итог — в design; скрипт ссылок, `openspec validate --all --strict`
- [x] 2.2 Прод после `add-dated-imagery`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (`gh pr checks --watch` возвращается рано — перепроверить список), merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзац «Прод после add-engine-timeout» в промпте следующей сессии.
