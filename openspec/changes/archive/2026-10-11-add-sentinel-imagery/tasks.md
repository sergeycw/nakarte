# Tasks

## 1. Слой

- [x] 1.1 Подложка `S2` в `catalog.ts` (год мозаики — константа, адрес и подпись из неё, место после `E`), превью `thumbnails/S2.webp` скриптом `scripts/layer-thumbnails.mjs S2`; unit `catalog.test.ts` (адрес, подпись с годом, 33 слоя) и `selection.test.ts` «Ссылка с Sentinel-2», browser «Атрибуция Sentinel-2» (`App.browser.test.tsx`), e2e «Ссылка с Sentinel-2» и «Список слоёв» (`map-layers.spec.ts`); проверка: эти тесты зелёные (CI — `check-web.yml`)
- [x] 1.2 Backlog: год мозаики (как проверить выход нового) и EOX в рисках; проверка: ссылки скриптом
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## 2. Ревью, PR, прод

- [x] 2.1 Независимое ревью диффа субагентом, исправления; итог — в design; скрипт ссылок, `openspec validate --all --strict`
- [x] 2.2 Скриншоты компьютера (1280×800), Pixel 7 и Pixel 7 landscape владельцу до merge: Кавказ на Sentinel-2 с треком, быстрые слои и `All layers`; проверка: кадры отправлены
- [x] 2.3 Прод после `palette-one-row`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; в `openspec/research/map-layers.md` в таблице changes — ссылка на архив; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
