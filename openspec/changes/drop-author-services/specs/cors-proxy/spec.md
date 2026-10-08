# Spec Delta

## MODIFIED Requirements

### Requirement: Только разрешённые origin

Прокси SHALL обслуживать только origin из `ALLOWED_ORIGINS`: по заголовку `Origin`, а без него — по origin из `Referer`. Остальным SHALL отвечать `403`. Сейчас разрешены `https://nakarte-routing.pages.dev`, локальные dev-серверы на 8765 и 8766 и karma на 9876: апстримные тесты `test_track_load.js` ходят в живые сервисы через этот прокси.

#### Scenario: Чужой сайт

- **WHEN** запрос пришёл с `Origin: https://example.com`
- **THEN** ответ `403`

#### Scenario: Запрос без Origin, но с Referer

- **WHEN** запрос без `Origin` пришёл с `Referer: https://nakarte-routing.pages.dev/#m=10/41/44`
- **THEN** запрос проксируется, `Access-Control-Allow-Origin` равен `https://nakarte-routing.pages.dev`

#### Scenario: Тесты karma

- **WHEN** запрос пришёл с `Origin: http://localhost:9876`
- **THEN** запрос проксируется, `Access-Control-Allow-Origin` равен `http://localhost:9876`

### Requirement: Фильтрация заголовков

К сервису SHALL уходить только заголовки `Accept`, `Accept-Language`, `Content-Type`, `Range` и `User-Agent`. `Set-Cookie` из ответа сервиса SHALL удаляться.

#### Scenario: Куки сервиса

- **WHEN** сервис ставит куку в ответе
- **THEN** клиент не получает `Set-Cookie`

#### Scenario: User-Agent клиента

- **WHEN** браузер запрашивает тайл Wikimapia через прокси
- **THEN** сервис получает `User-Agent` браузера, а не пустой заголовок

## ADDED Requirements

### Requirement: Куки Strava для тайлов heatmap

Если у прокси задан секрет `STRAVA_COOKIES` (куки `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` вошедшего аккаунта Strava), прокси SHALL подставлять его заголовком `Cookie` в запросы к тайлам `content-*.strava.com/identified/globalheat/` и SHALL NOT отправлять его на другие адреса. Без секрета запросы уходят без кук.

#### Scenario: Тайл heatmap

- **WHEN** разрешённая страница запрашивает `/https/content-a.strava.com/identified/globalheat/all/hot/12/2557/1514.png?px=256`
- **THEN** запрос к Strava уходит с куками из секрета

#### Scenario: Другой адрес Strava

- **WHEN** запрошен `/https/www.strava.com/activities/1/streams`
- **THEN** куки из секрета к запросу не добавляются

### Requirement: HEAD как GET

Запрос `HEAD` прокси SHALL отправлять сервису методом `GET` и SHALL возвращать клиенту статус и заголовки ответа без тела, как авторский прокси на nginx: часть сервисов отвечает на `HEAD` иначе, чем на `GET`.

#### Scenario: Короткая ссылка mapy.com

- **WHEN** клиент делает `HEAD /https/mapy.com/s/favepemeko`
- **THEN** сервис получает `GET` и отвечает редиректом `301`, клиент получает переписанный `Location` без тела
