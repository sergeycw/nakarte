# Proposal

## Why

После своих сервисов треков и высот, удалённых провайдеров панорам и слоёв на данных автора у приложения остаются последние обращения к инфраструктуре автора: слои mapy.cz через `proxy.nakarte.me/mapy/…` (захардкожено в `src/layers.js`), адреса автора по умолчанию в `src/config.js` (сборка без цели ходит в `proxy.nakarte.me`, `tracks.nakarte.me`, `elevation.nakarte.me`, `tiles.nakarte.me/elevation`, `nakarte.me/event`), ссылки в подписи карты на docs, news, donate и почту автора. Решение владельца 2026-10-08: свой продукт на базе nakarte, апстрим — справочник (`AGENTS.md`, «Апстрим»), поэтому свои сервисы становятся значениями по умолчанию, а не переопределением клона. Change закрывает автономию и фиксирует её проверяемым требованием. Делается и архивируется последним из плана `openspec/research/own-backends.md`.

## What Changes

- Слои «mapy.cz tourist (Out of order)» (`Czt`) и «mapy.cz winter (Out of order)» (`Czw`) удалены из `src/layers.js`: ключа mapy.cz у владельца нет, у автора они помечены неработающими. Свой маршрут `/mapy/` в прокси не делается. Поиск mapy.cz и ссылка на mapy.cz во внешних картах остаются.
- Значения по умолчанию в `src/config.js` — свои Worker'ы: `CORSProxyUrl`, `wikimapiaTilesBaseUrl`, `tracksStorageServer`, `elevationsServer`, `elevationTileUrl`, `elevationsAttribution`; `eventsLogUrl` и `sentryDSN` пустые, Sentry без DSN не инициализируется. В `src/config-target/clone.js` остаются только отличия сборки клона от локального серверного режима: `routingEngine` и `routingTilesPath`.
- Из `src/secrets.js.template` удалены заглушки `sentryDSN` и неиспользуемый `mapyCz`.
- Подпись карты (`caption`) — короткое название и ссылка на репозиторий форка `https://github.com/sergeycw/nakarte`, без донатов и почты.
- Прокси `nakarte-cors-proxy` пускает origin karma `http://localhost:9876`: тесты `test_track_load.js` теперь идут через свой прокси.
- Скрипт `scripts/check-no-author-hosts.mjs` ищет адреса `*.nakarte.me` в собранном бандле, кроме известных строк-метаданных, и запускается в `deploy-pages.yml` после сборки: находка останавливает деплой.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: «Сборка под клон» — клон отличается только движком в браузере и путём тайлов, свои сервисы и подпись — во всех сборках; новые требования «Без запросов к инфраструктуре автора» и «Без слоёв mapy.cz».
- `clone-deploy`: новое требование — деплой падает, если в бандле есть адреса `*.nakarte.me`.
- `cors-proxy`: «Только разрешённые origin» — в списке origin karma.

## Impact

- Апстримные файлы: `src/config.js`, `src/layers.js`, `src/index.js`, `src/secrets.js.template`. Сборка без цели теперь тоже ходит в свои Worker'ы.
- `src/config-target/clone.js`, `workers/cors-proxy/wrangler.toml`, `.github/workflows/deploy-pages.yml`, новый `scripts/check-no-author-hosts.mjs`.
- Строки `nakarte.me`, которые не являются запросами (`creator="http://nakarte.me"` в GPX, имя файла JNX, текст уведомления сессий, `<title>`), не трогаются: переименование продукта — вне этого change.
- Зависимость: архивировать последним из changes `own-backends.md`.
