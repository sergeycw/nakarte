# Tasks

## 1. Строка и фокус

- [ ] 1.1 Одна строка из шести в `ColorPicker.tsx`, предел недавних 3 в `recent-colors.ts`, `initialFocus` по способу открытия; browser «Недавние цвета», «Фокус при открытии» (`TrackList.browser.test.tsx`); проверка: browser `TrackList` и `RouteEditor` зелёные
- [ ] 1.2 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Ревью, PR, прод

- [ ] 2.1 Независимое ревью диффа субагентом, исправления; итог — в design; скрипт ссылок, `openspec validate --all --strict`
- [ ] 2.2 Скриншоты компьютера (1280×800), Pixel 7 и Pixel 7 landscape владельцу до merge: палитра с недавними в строке редактора и в списке; проверка: кадры отправлены
- [x] 2.3 Прод после `track-color-picker`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом. В backlog пункта нет.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
