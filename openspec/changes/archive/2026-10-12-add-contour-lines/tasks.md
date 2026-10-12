# Tasks

## 1. Слой

- [x] 1.1 Зависимость `maplibre-contour` 0.1.1 в `web/` (lock-файл — `npx --yes npm@11 install`), в `optimizeDeps.include` browser-проекта `vitest.config.ts`; проверка: `npm run typecheck` зелёный
- [x] 1.2 Оверлей `Ct` в `catalog.ts` (векторный источник `nakarte-contours://{z}/{x}/{y}`, `minzoom` 10, `maxzoom` 15, адрес Terrarium — общая константа с `Hs`, место после `Hs`); unit `catalog.test.ts` (34 слоя, источник, порядок `Hs` < `Ct` < `Sa`) и `selection.test.ts` (`l=O/Ct`); e2e «Список слоёв» — 34 флажка; проверка: эти тесты зелёные (CI — `check-web.yml`)
- [x] 1.3 Линии и подписи в `style.ts` (`Ct` и `Ct-labels`); unit `style.test.ts` «Горизонтали над отмывкой» (порядок слоёв стиля, подписи только у основных); проверка: тест зелёный
- [x] 1.4 Протокол `web/src/layers/contours.ts` (ленивый импорт библиотеки, шаг по зуму, воркер в проде, `transformRequest` для тестов), регистрация в `map/maplibre.ts`, фикстура `src/test/tiles.ts` пропускает адреса протокола горизонталей, `renderApp` ставит тестовый протокол; browser `contours.browser.test.tsx` «Горизонтали из рельефа» (синтетический склон Terrarium, линии через 20 м и подписи основных отрисованы, запросы рельефа — через фикстуру, внешних нет, подпись Terrain Tiles) и «Горизонтали на мелком зуме»; проверка: тесты зелёные
- [x] 1.5 Документы: `AGENTS.md` (абзац «Слои и адрес» — ссылка на архив, подвох Blob-воркера и `transformRequest`), `docs/architecture/client.md` (строка `layers/`), `docs/architecture/decisions.md` (строка в «Панорамы и слои»); проверка: ссылки скриптом
- [x] 1.6 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные

## 2. Ревью, PR, прод

- [x] 2.1 Независимое ревью диффа субагентом, исправления; итог — в design; скрипт ссылок, `openspec validate --all --strict`
- [x] 2.2 Скриншоты против dev-сервера: Казбеги `m=14` на OSM, Tracestrack и спутнике с горизонталями и отмывкой, компьютер 1280×800 и Pixel 7; шаг и цвет поправлены по кадрам; проверка: кадры отправлены владельцу
- [x] 2.3 Прод после `add-sentinel-imagery`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; в `openspec/research/map-layers.md` в таблице changes — ссылка на архив; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите (`gh pr checks --watch` возвращается рано — перепроверить список), merge.
- После деплоя: `prod check`, вид `/` на компьютере и Pixel 7 с `Ct`; итог — абзац «Прод после add-contour-lines» в промпте следующей сессии.
