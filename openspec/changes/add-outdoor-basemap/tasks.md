# Tasks

## 1. Прокси: ключ Tracestrack

- [x] 1.1 `workers/cors-proxy/src/index.js`: тайл `topo__` на `tile.tracestrack.com` — запрос клиента отброшен, `key` из `TRACESTRACK_KEY`; без секрета `503` без запроса наружу; `Location` без `key`; `Cache-Control` по умолчанию на `200` без него; хост в `LAYER_HOSTS`. Тесты в `test/tracestrack.test.js` (заглушка Tracestrack в `vitest.config.js`, секрет — привязкой; без секрета — `env` с удалённой привязкой), лимит слоёв для `tile.tracestrack.com`; проверка: `npm test` в `workers/cors-proxy` и `npm run lint` из корня зелёные (CI — `check-cors-proxy.yml`, `check-lint.yml`)

## 2. Приложение: слой и умолчание

- [x] 2.1 `web/src/layers/catalog.ts`: слой `Tt` (через прокси, `{ratio}`, `maxzoom: 19`, атрибуция Tracestrack и OSM), первым в `ORDER`; `selection.ts`: `DEFAULT_SELECTION` — `Tt`; unit-тесты каталога и выбора; проверка: `npm test` в `web/` (unit) зелёный
- [x] 2.2 Откат: стор (`basemapFallback`, сброс явным выбором и `l=`), `sync.ts` (сохраняется выбор без отката), `App.tsx` (ошибка тайла `Tt` не `404` → откат и тост вместо тоста ошибки); unit-тесты стора и `sync`, browser-тесты отката и `404`; проверка: `npm test` в `web/` зелёный
- [x] 2.3 Существующие тесты, считавшие OSM умолчанием (unit, browser, e2e: «Первый заход», тайлы z8, тост ошибки тайлов с `l=O`), — по спекам change; e2e отката на сборке (`failTiles('Tt')`); проверка: `npm run lint`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 3. Мониторинг и документы

- [ ] 3.1 `.github/workflows/tracestrack-check.yml` по образцу `strava-heatmap-check.yml`: `200 image/*` — зелёный, `503` — `::warning::`, остальное — красный; проверка: `actionlint`, ручной прогон после деплоя (до ключа — предупреждение)
- [x] 3.2 `AGENTS.md` (слой по умолчанию, ключ Tracestrack, подвох с сохранённым выбором), `docs/architecture/` (`cors-proxy.md`, `client.md`, `ci-cd.md`, `decisions.md`), `openspec/backlog.md` (пункт MapMagic закрыт, кеш и защита тайлов Tracestrack, свой стиль на OpenFreeMap), ресёрч («Вопросы владельцу» закрыт); проверка: скрипт ссылок — все файлы и разделы существуют
- [x] 3.3 `openspec validate --all --strict`

## 4. Ревью, PR, прод

- [x] 4.1 Скриншоты `/` на компьютере и Pixel 7 (headless Playwright против `vite preview`, тайлы Tracestrack — `context.route`), отправить владельцу
- [x] 4.2 Независимое ревью диффа субагентом, исправления
- [ ] 4.3 PR в `master`, все проверки `pass` на последнем коммите, merge
- [ ] 4.4 После деплоя: `prod check`, `tracestrack check` (до ключа — предупреждение), `/` на проде без ключа — OSM с тостом отката, `l=O` — без тоста; CORS прокси на тайл `Tt`; итог — design, «Проверки»; шаг владельца с ключом — в отчёт
- [ ] 4.5 Archive вторым PR, ссылки после archive, строка change в таблице «Changes по порядку» ресёрча
