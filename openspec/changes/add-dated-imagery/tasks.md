# Tasks

## 1. Слой и дата

- [x] 1.1 Подложка `Hls` в `catalog.ts` (шаблоны L30 и S30 с `{date}`, признак `dated`, подпись с `{year}`, `maxzoom` 12, место после `S2`); `{date}` в `templateToRegExp` `e2e/fixtures.ts`; unit `catalog.test.ts` (35 слоёв, шаблоны `Hls`), e2e «Список слоёв» — 35 флажков; проверка: тесты зелёные (CI — `check-web.yml`)
- [x] 1.2 Модуль `web/src/layers/dated.ts`: запрос и разбор Earth Search, схлопывание дней, дата по умолчанию, `withDate`, разбор `d=`; фикстура `src/layers/fixtures/earth-search.json`; unit `dated.test.ts` («Дата по умолчанию» и разбор); проверка: тест зелёный
- [x] 1.3 `style.ts` — по источнику на шаблон у слоя с `dated`, `BaseMap` — `withDate` и код ошибки тайла до `@`; unit `style.test.ts`; проверка: тест зелёный
- [x] 1.4 Стор `imageryDate`, `sync.ts` — `d=` при старте, на `hashchange` и в адрес только при слое с `dated`; unit `sync.test.ts` («Снимок за дату из ссылки», «Другая подложка»); проверка: тест зелёный
- [x] 1.5 Кнопка `ImageryDate.tsx` в `MapActions` (дата по умолчанию, список, «Other date», «Dates unavailable» и «Retry»), `fetch` из `App`; browser `ImageryDate.browser.test.tsx` по сценариям «Снимки по датам»; проверка: тесты зелёные
- [x] 1.6 Превью `thumbnails/Hls.webp` скриптом `scripts/layer-thumbnails.mjs` (дата для превью — константа скрипта); проверка: файл есть, круг в столбце — картинка
- [x] 1.7 Документы: `AGENTS.md` (абзац «Слои и адрес»), `docs/architecture/` (внешние сервисы GIBS и Earth Search, строка решений); проверка: ссылки скриптом
- [x] 1.8 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## 2. Ревью, вид, прод

- [ ] 2.1 Независимое ревью диффа субагентом, исправления; итог — в design; скрипт ссылок, `openspec validate --all --strict`
- [ ] 2.2 Скриншоты против dev-сервера: Казбеги `l=Hls` по умолчанию и с открытым списком дат, компьютер 1280×800 и Pixel 7; проверка: кадры отправлены владельцу
- [ ] 2.3 Прод после `add-contour-lines`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; в `openspec/research/map-layers.md` и `dated-imagery.md` в таблицах changes — ссылка на архив; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (`gh pr checks --watch` возвращается рано — перепроверить список), merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7 с `l=Hls`; итог — абзац «Прод после add-dated-imagery» в промпте следующей сессии.
