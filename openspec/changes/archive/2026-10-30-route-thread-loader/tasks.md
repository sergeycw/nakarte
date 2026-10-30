# Tasks

## 1. Нитка

- [x] 1.1 Замер кривой `favicon.svg` в Chromium (длина, вход в квадрат и выход из него) скриптом вне репозитория; `web/src/routing/RouteThread.tsx` с видами `badge` и `icon`, `@keyframes route-thread` и `motion-reduce` в `web/src/index.css`; проверка: `npm run typecheck` и `npm run lint` в `web/` зелёные
- [x] 1.2 Нитка вместо спиннера в `RoutingButton.tsx` (ожидание и загрузка движка) и `TracksButton` (ожидание; загрузка по ссылке — спиннер); проверка: browser-тесты «Нитка на кнопке прокладки», «Загрузка треков по ссылке» и «Меньше движения» зелёные, прежние тесты блока «Ожидание прокладки в верхней строке» зелёные (CI — `check-web.yml`)

## 2. Бейдж у указателя

- [x] 2.1 `RoutingBadgeOnMap.tsx` в `BaseMap.tsx`, ветка `progress` из `MapEditor.updateCursor` удалена, `PointerEvent` мыши в `fire` из `src/test/map-events.ts`; проверка: browser-тесты «Ожидание маршрута», «Нет маршрута», «Курсор рисования во время ожидания», «Указатель ушёл с карты», «Клик сквозь бейдж», «Касание без бейджа» и `Autosave.browser.test.tsx` «Перезагрузка во время прокладки» зелёные (CI — `check-web.yml`)
- [x] 2.2 Скриншоты бейджа и кнопок на живой карте (headless Playwright из `web/node_modules/playwright`, кадры фаз), подбор долей фаз, толщины нитки и смещения бейджа; итог — в design; проверка: лист кадров отправлен владельцу

## 3. Кнопка геолокации

- [x] 3.1 Маска значка и цвета `-active` и `-background` геолокации в `web/src/index.css`; проверка: browser-тесты «Слежение включено» и «Слежение в фоне» в `MapButtons.browser.test.tsx` зелёные (CI — `check-web.yml`), скриншот кнопки в обоих состояниях — в листе задачи 2.2

## 4. Документы и полный прогон

- [x] 4.1 `AGENTS.md` (раздел «Приложение»: ожидание — нитка `RouteThread.tsx`, бейдж `RoutingBadgeOnMap.tsx`; подвох про синтетические `PointerEvent` в `fire`), строка про ожидающий отрезок в `docs/architecture/decisions.md`; проверка: скрипт ссылок, `openspec validate --all --strict`
- [x] 4.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные
- [x] 4.3 Независимое ревью диффа субагентом, исправления; итог — в design

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`; итог — абзацем «Прод после route-thread-loader» в промпте следующей сессии.
