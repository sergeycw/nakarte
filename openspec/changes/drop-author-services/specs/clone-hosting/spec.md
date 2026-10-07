# Spec Delta

## MODIFIED Requirements

### Requirement: Сборка под клон

Сборка с `NAKARTE_TARGET=clone` SHALL включать движок в браузере по умолчанию, брать тайлы из `/tiles/`, ходить через свой CORS-прокси (и для Wikimapia, и для тайлов mapy.cz), не отправлять события на `nakarte.me/event`, не включать Sentry и показывать свою подпись карты со ссылкой на репозиторий форка. Сборка без цели SHALL вести себя как апстрим.

#### Scenario: Сборка клона

- **WHEN** приложение собрано с `NAKARTE_TARGET=clone`
- **THEN** `routingEngine` равен `'browser'`, `routingTilesPath` — `'/tiles/'`, `CORSProxyUrl` указывает на `nakarte-cors-proxy.nakarte-routing.workers.dev`
- **AND** запросов на `https://nakarte.me/event` и в Sentry нет

#### Scenario: Подпись карты клона

- **WHEN** пользователь открывает клон
- **THEN** в подписи карты нет ссылок на `docs.nakarte.me`, `about.nakarte.me` и `nakarte@nakarte.me`, есть ссылка на репозиторий форка

## ADDED Requirements

### Requirement: Без запросов к инфраструктуре автора

Клон SHALL не делать сетевых запросов к `nakarte.me` и его поддоменам при работе всех функций: слои, панорамы, треки, ссылки, высоты, перевалы, геокешинг, печать.

#### Scenario: Сквозная проверка

- **WHEN** в клоне по очереди включаются все слои и панорамы, строится трек с профилем высот, делается «Copy link» и печать
- **THEN** в журнале сетевых запросов нет ни одного адреса `*.nakarte.me`
