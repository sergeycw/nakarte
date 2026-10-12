# Tasks

## 1. Кнопка

- [x] 1.1 `QuickLayers.tsx`: кнопка `QuickDated` (иконка `Satellite`, `aria-pressed`, второе нажатие — прежняя подложка или подложка по умолчанию), превью без слоёв с `dated`; место в столбце — `LayerSwitcher.tsx`; browser `ImageryDate.browser.test.tsx` («Снимки по датам кнопкой», «Ссылка со снимками по датам»); проверка: тесты зелёные (CI — `check-web.yml`)
- [x] 1.2 Документы: `AGENTS.md` (абзац «Раскладка»), `docs/architecture/decisions.md` (строка раскладки); проверка: ссылки скриптом
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные
- [x] 1.4 Скриншоты столбца против dev-сервера, компьютер 1280×800 и Pixel 7; проверка: кадры отправлены владельцу

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (перепроверить список), merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7; итог — абзац «Прод после …» в промпте следующей сессии.
