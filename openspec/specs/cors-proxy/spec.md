# cors-proxy Specification

## Purpose

Свой CORS-прокси клона вместо авторского `proxy.nakarte.me`, который не пускает чужой домен. Через прокси идут импорт треков по ссылкам, часть слоёв, поиск по ссылкам и растеризация для печати. Повторяет протокол авторского прокси, чтобы код nakarte работал без правок.

## Requirements

### Requirement: Формат адреса

Прокси SHALL принимать адреса вида `/<схема>/<хост>/<путь>?<запрос>` и запрашивать `<схема>://<хост>/<путь>?<запрос>`, где схема — `http` или `https`. Адрес `/wikimapia/<путь>` SHALL вести на `http://wikimapia.org/<путь>`. Прочие адреса SHALL получать `404`.

#### Scenario: Запрос через прокси

- **WHEN** разрешённая страница запрашивает `/https/www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4`
- **THEN** прокси запрашивает `https://www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4` и возвращает ответ

#### Scenario: Неизвестный путь

- **WHEN** запрошен `/ftp/example.com/file`
- **THEN** ответ `404`

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

### Requirement: CORS-заголовки

Ответ SHALL содержать `Access-Control-Allow-Origin` с origin вызывающей страницы, `Access-Control-Allow-Credentials: true` и открывать наружу `Content-Disposition`. На `OPTIONS` прокси SHALL отвечать `204` с разрешёнными методами `POST, GET, HEAD, OPTIONS` и запрошенными заголовками.

#### Scenario: Имя файла из Content-Disposition

- **WHEN** сервис отдаёт трек с `Content-Disposition: attachment; filename="run.gpx"`
- **THEN** страница может прочитать этот заголовок

### Requirement: Редиректы остаются в прокси

Прокси SHALL NOT следовать редиректам сам. Заголовок `Location` SHALL переписываться в форму прокси, чтобы браузер шёл по редиректу снова через прокси, а конечный URL ответа был адресом прокси.

#### Scenario: Короткая ссылка

- **WHEN** сервис отвечает `302` с `Location: https://www.strava.com/activities/123`
- **THEN** клиент получает `Location: <прокси>/https/www.strava.com/activities/123`

### Requirement: Фильтрация заголовков

К сервису SHALL уходить только заголовки `Accept`, `Accept-Language`, `Content-Type`, `Range` и `User-Agent`. `Set-Cookie` из ответа сервиса SHALL удаляться.

#### Scenario: Куки сервиса

- **WHEN** сервис ставит куку в ответе
- **THEN** клиент не получает `Set-Cookie`

#### Scenario: User-Agent клиента

- **WHEN** браузер запрашивает тайл Wikimapia через прокси
- **THEN** сервис получает `User-Agent` браузера, а не пустой заголовок

### Requirement: Куки Strava для тайлов heatmap

Если у прокси задан секрет `STRAVA_COOKIES` (куки `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` и JWT `_strava_idcf` вошедшего аккаунта Strava; без `_strava_idcf` функция CloudFront отвечает `401`), прокси SHALL подставлять его заголовком `Cookie` в запросы к тайлам `content-*.strava.com/identified/globalheat/` и SHALL NOT отправлять его на другие адреса. Без секрета запросы уходят без кук.

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
