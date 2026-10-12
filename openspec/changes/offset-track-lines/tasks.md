# Tasks

## 1. Смещение

- [x] 1.1 `TRACK_LINE_OFFSET` и `line-offset` у слоёв треков, непроложенных, редактора и выделения профиля; unit `style.test.ts` «Радиалка»; проверка: тест зелёный (CI — `check-web.yml`), browser-тесты кликов и редактора зелёные
- [x] 1.2 Скриншот радиалки против dev-сервера на крупном зуме; проверка: кадр отправлен владельцу
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (перепроверить список), merge.
