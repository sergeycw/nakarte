# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
