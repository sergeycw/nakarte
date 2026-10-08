# Spec Delta

## MODIFIED Requirements

### Requirement: Сборка под клон

Сборка с `NAKARTE_TARGET=clone` SHALL включать движок в браузере по умолчанию и брать тайлы из `/tiles/`; в остальном она SHALL совпадать со сборкой без цели. Обе сборки SHALL ходить через свой CORS-прокси (и для Wikimapia), в свои хранилище треков и сервис высот, не отправлять события, не инициализировать Sentry и показывать подпись карты со ссылкой на репозиторий форка.

#### Scenario: Сборка клона

- **WHEN** приложение собрано с `NAKARTE_TARGET=clone`
- **THEN** `routingEngine` равен `'browser'`, `routingTilesPath` — `'/tiles/'`, `CORSProxyUrl` указывает на `nakarte-cors-proxy.nakarte-routing.workers.dev`
- **AND** запросов на `nakarte.me/event` и в Sentry нет

#### Scenario: Сборка без цели

- **WHEN** приложение собрано без `NAKARTE_TARGET`
- **THEN** `routingEngine` равен `'server'`, а прокси, хранилище треков и сервис высот — те же Worker'ы, что у клона

#### Scenario: Подпись карты

- **WHEN** пользователь открывает приложение
- **THEN** в подписи карты нет ссылок на `docs.nakarte.me`, `about.nakarte.me` и `nakarte@nakarte.me`, есть ссылка на `https://github.com/sergeycw/nakarte`

## ADDED Requirements

### Requirement: Без слоёв mapy.cz

Приложение SHALL не содержать слоёв «mapy.cz tourist (Out of order)» (`Czt`) и «mapy.cz winter (Out of order)» (`Czw`): они шли через `proxy.nakarte.me/mapy/`, своего ключа mapy.cz нет. Поиск mapy.cz и ссылка на mapy.cz во внешних картах SHALL оставаться.

#### Scenario: Выбор слоёв

- **WHEN** пользователь открывает выбор слоёв
- **THEN** слоёв mapy.cz в нём нет, запросов к `proxy.nakarte.me/mapy/` нет

### Requirement: Без запросов к инфраструктуре автора

Приложение SHALL не делать сетевых запросов к `nakarte.me` и его поддоменам при работе всех функций: слои, панорамы, треки, ссылки, высоты, печать. Строки `nakarte.me`, которые не являются адресами запросов (`<title>`, `creator` в GPX, имя файла JNX, текст уведомления сессий), допустимы.

#### Scenario: Сквозная проверка

- **WHEN** по очереди включаются все слои, открывается панорама Street View, строится трек с профилем высот, делается «Copy link» и печать
- **THEN** в журнале сетевых запросов нет ни одного адреса `*.nakarte.me`
