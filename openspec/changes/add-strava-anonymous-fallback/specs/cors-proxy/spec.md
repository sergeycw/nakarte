# Spec Delta

## MODIFIED Requirements

### Requirement: Источник кук Strava в ответе тайла

Ответ на запрос тайла heatmap SHALL содержать заголовок `X-Strava-Cookies` со значением `session` (куки получены по сессии), `fallback` (из `STRAVA_COOKIES`), `anonymous` (тайл взят с анонимного адреса без кук) или `none` (без кук) и SHALL NOT содержать самих кук. На другие адреса заголовок не ставится. По нему владелец проверяет, что сессия работает, пока `STRAVA_COOKIES` ещё жив.

#### Scenario: Куки по сессии

- **WHEN** тайл запрошен после успешного обновления
- **THEN** в ответе `X-Strava-Cookies: session`

#### Scenario: Не тайл heatmap

- **WHEN** запрошен `/https/www.strava.com/activities/1/streams`
- **THEN** заголовка `X-Strava-Cookies` в ответе нет

## ADDED Requirements

### Requirement: Анонимные тайлы heatmap без кук

Если для тайла heatmap у прокси нет кук или CloudFront ответил на него `401` или `403`, прокси SHALL запросить тот же тайл без кук с `https://heatmap-external-{a,b,c}.strava.com/tiles/<активность>/<цвет>/<z>/<x>/<y>.png` с тем же `px`, если зум не выше 12 для `px=256` и не выше 11 для `px=512`, и вернуть этот ответ с `X-Strava-Cookies: anonymous`. Выше этих зумов прокси SHALL вернуть исходный ответ.

#### Scenario: Сессии нет, обзорный зум

- **WHEN** секретов Strava нет и запрошен `/https/content-a.strava.com/identified/globalheat/all/hot/12/2557/1514.png?px=256`
- **THEN** прокси без кук запрашивает `heatmap-external-*.strava.com/tiles/all/hot/12/2557/1514.png?px=256` и отвечает с `X-Strava-Cookies: anonymous`

#### Scenario: Куки протухли

- **WHEN** тайл z11 ушёл с `STRAVA_COOKIES`, а CloudFront ответил `403`
- **THEN** клиент получает анонимный тайл с `X-Strava-Cookies: anonymous`

#### Scenario: Крупный зум без кук

- **WHEN** секретов Strava нет и запрошен тайл z13
- **THEN** анонимный адрес не запрашивается, клиент получает ответ CloudFront и `X-Strava-Cookies: none`

#### Scenario: 512 px на z12

- **WHEN** секретов Strava нет и запрошен тайл z12 с `px=512`
- **THEN** анонимный адрес не запрашивается
