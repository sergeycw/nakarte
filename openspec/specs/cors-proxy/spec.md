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

Прокси SHALL подставлять заголовком `Cookie` куки `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` и `_strava_idcf` в запросы к тайлам `content-*.strava.com/identified/globalheat/` и SHALL NOT отправлять их на другие адреса. Источник кук — обновление по сессии из секрета `STRAVA_SESSION`; пока свежих кук нет, — секрет `STRAVA_COOKIES`, если он задан. Без обоих запросы уходят без кук.

#### Scenario: Тайл heatmap

- **WHEN** разрешённая страница запрашивает `/https/content-a.strava.com/identified/globalheat/all/hot/12/2557/1514.png?px=256`
- **THEN** запрос к Strava уходит с куками CloudFront и `_strava_idcf`

#### Scenario: Другой адрес Strava

- **WHEN** запрошен `/https/www.strava.com/activities/1/streams`
- **THEN** куки CloudFront и сессия к запросу не добавляются

#### Scenario: Сессия не задана

- **WHEN** секрета `STRAVA_SESSION` нет, а `STRAVA_COOKIES` задан
- **THEN** тайл heatmap запрашивается с куками из `STRAVA_COOKIES`

### Requirement: HEAD как GET

Запрос `HEAD` прокси SHALL отправлять сервису методом `GET` и SHALL возвращать клиенту статус и заголовки ответа без тела, как авторский прокси на nginx: часть сервисов отвечает на `HEAD` иначе, чем на `GET`.

#### Scenario: Короткая ссылка mapy.com

- **WHEN** клиент делает `HEAD /https/mapy.com/s/favepemeko`
- **THEN** сервис получает `GET` и отвечает редиректом `301`, клиент получает переписанный `Location` без тела

### Requirement: Обновление кук Strava по сессии

Если задан `STRAVA_SESSION`, прокси SHALL получать куки heatmap сам: запросом `GET https://www.strava.com/maps/global-heatmap` с этой сессией, следуя редиректам только внутри `https://www.strava.com`. Полученные куки SHALL использоваться до срока из `CloudFront-Policy` за вычетом запаса; параллельные запросы тайлов SHALL ждать одно обновление.

#### Scenario: Первое обращение к тайлу

- **WHEN** задан `STRAVA_SESSION`, а свежих кук у прокси нет
- **THEN** прокси запрашивает страницу heatmap с сессией и отправляет тайл с полученными куками

#### Scenario: Куки ещё свежие

- **WHEN** куки получены, а до срока политики больше запаса
- **THEN** следующий тайл уходит с ними же, без нового запроса страницы

#### Scenario: Срок подходит

- **WHEN** до срока политики осталось меньше запаса
- **THEN** прокси получает куки заново

#### Scenario: Параллельные тайлы

- **WHEN** несколько тайлов запрошены одновременно, а свежих кук нет
- **THEN** страница heatmap запрашивается один раз

### Requirement: Пауза после неудачного обновления

Если обновление не дало все четыре куки (сессия отклонена, редирект за пределы `www.strava.com`, ошибка сети), прокси SHALL использовать `STRAVA_COOKIES` или запрашивать тайл без кук и SHALL NOT повторять обновление в течение паузы около 10 минут. В журнал SHALL попадать причина с именами кук и статусом, без значений.

#### Scenario: Сессия отклонена

- **WHEN** страница heatmap отвечает редиректом на `/login`
- **THEN** тайл уходит с `STRAVA_COOKIES`, а следующий тайл в течение паузы не вызывает запроса страницы

#### Scenario: Пауза прошла

- **WHEN** после неудачи прошло больше паузы
- **THEN** следующий тайл снова запускает обновление

### Requirement: Сессия Strava не покидает прокси

Сессия из `STRAVA_SESSION` SHALL уходить только в запросы обновления к `https://www.strava.com`. Ни сессия, ни куки, полученные при обновлении, SHALL NOT попадать в ответ клиенту, в том числе в `Set-Cookie`.

#### Scenario: Тайл не получает сессию

- **WHEN** прокси запрашивает тайл heatmap
- **THEN** в заголовке `Cookie` тайла нет `_strava4_session`

#### Scenario: Ответ клиенту

- **WHEN** клиент получает тайл heatmap после обновления
- **THEN** в ответе нет `Set-Cookie` и значений кук

### Requirement: Источник кук Strava в ответе тайла

Ответ на запрос тайла heatmap SHALL содержать заголовок `X-Strava-Cookies` со значением `session` (куки получены по сессии), `fallback` (из `STRAVA_COOKIES`) или `none` (без кук) и SHALL NOT содержать самих кук. На другие адреса заголовок не ставится. По нему владелец проверяет, что сессия работает, пока `STRAVA_COOKIES` ещё жив.

#### Scenario: Куки по сессии

- **WHEN** тайл запрошен после успешного обновления
- **THEN** в ответе `X-Strava-Cookies: session`

#### Scenario: Не тайл heatmap

- **WHEN** запрошен `/https/www.strava.com/activities/1/streams`
- **THEN** заголовка `X-Strava-Cookies` в ответе нет
