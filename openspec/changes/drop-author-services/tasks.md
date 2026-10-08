# Tasks

## 1. Прокси

- [x] 1.1 Origin karma `http://localhost:9876` в `ALLOWED_ORIGINS` `workers/cors-proxy/wrangler.toml`; проверка: тест прокси «origin karma пропускается» зелёный в `check-cors-proxy.yml`, после merge прокси задеплоен `deploy-pages.yml`
- [x] 1.2 Прокси пересылает `User-Agent` и подставляет секрет `STRAVA_COOKIES` в тайлы Strava heatmap; проверка: тесты прокси «forwards User-Agent» и «adds Strava cookies only to heatmap tiles» зелёные в `check-cors-proxy.yml`, после деплоя Wikimapia через прокси отвечает `200`
- [x] 1.3 `HEAD` уходит к сервису как `GET`; проверка: тест прокси «sends HEAD upstream as GET» зелёный, `test_search_links.js` с короткими ссылками mapy.com проходит через свой прокси

## 2. Клиент

- [x] 2.1 Удалить слои `Czt` и `Czw` из `src/layers.js`; проверка: тест karma `test/test_own_backends.js` — в адресах слоёв нет `nakarte.me`, кодов `Czt`, `Czw` нет; `test/test_layers.js` зелёный
- [x] 2.2 Свои сервисы по умолчанию в `src/config.js`, в `clone.js` только `routingEngine` и `routingTilesPath`; `eventsLogUrl` и `sentryDSN` пустые, заглушки `sentryDSN` и `mapyCz` убраны из шаблона секретов, `Sentry.init` только с DSN; проверка: тест karma — адреса сервисов конфига не на `nakarte.me`, `eventsLogUrl` и `sentryDSN` пустые
- [x] 2.3 Подпись карты — название и ссылка на репозиторий форка; проверка: тест karma — в `caption` нет `nakarte.me`, есть `github.com/sergeycw/nakarte`
- [x] 2.4 `test_track_load.js` через свой прокси локально, как в CI (шаблон секретов); проверка: тесты проходят, сетевые тесты Strava и Garmin, которые проходили только через авторский прокси, убраны с причиной в `design.md`
- [x] 2.6 Короткие ссылки `goo.gl/maps` через свой прокси: адрес из `continue` капчи Google; проверка: `test_search_links.js` зелёный
- [x] 2.5 Поиск mapy.cz через свой прокси; проверка: в браузере на 8766 поиск находит место, иначе — пункт в бэклоге

## 3. Без запросов к автору

- [ ] 3.1 `scripts/check-no-author-hosts.mjs` и шаг в `deploy-pages.yml` после сборки; проверка: скрипт падает на бандле клона до правок и проходит после, деплой зелёный
- [x] 3.2 Сквозная проверка в браузере на локальном клоне (8766) и сборке без цели (8770): все слои по очереди, Street View, трек с профилем высот, «Copy link», печать; проверка: в журнале сети нет `*.nakarte.me`, Sentry не инициализирован
- [x] 3.3 Обновить `AGENTS.md` (авторские бэкенды, прокси в karma, слои Google и mapy.cz, локальные переопределения), `openspec/research/own-backends.md` (статус, карта бэкендов), `openspec/backlog.md` (mapy.cz); проверка: `openspec validate --all --strict`, нет утверждений, что приложение использует бэкенды автора

## 4. Прод

- [ ] 4.1 На `https://nakarte-routing.pages.dev` повторить сквозную проверку 3.2; проверка: запросов к `*.nakarte.me` нет

## Workflow follow-up

- Архивировать последним из changes `own-backends.md`: `openspec archive drop-author-services --yes`.
