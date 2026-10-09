## ADDED Requirements

### Requirement: Разрешённые origin клона

Прокси SHALL обслуживать только origin из `ALLOWED_ORIGINS`: по заголовку `Origin`, а без него — по origin из `Referer`. Остальным SHALL отвечать `403`. Разрешены сайт клона `https://nakarte-routing.pages.dev`, dev-сервер приложения `http://localhost:8769` и `vite preview` `http://localhost:4173`.

#### Scenario: Чужой сайт

- **WHEN** запрос пришёл с `Origin: https://example.com`
- **THEN** ответ `403`

#### Scenario: Запрос без Origin, но с Referer

- **WHEN** запрос без `Origin` пришёл с `Referer: https://nakarte-routing.pages.dev/#m=10/41/44`
- **THEN** запрос проксируется, `Access-Control-Allow-Origin` равен `https://nakarte-routing.pages.dev`

#### Scenario: Локальный dev-сервер приложения

- **WHEN** запрос пришёл с `Origin: http://localhost:8769`
- **THEN** запрос проксируется, `Access-Control-Allow-Origin` равен `http://localhost:8769`

#### Scenario: Порт старого клиента

- **WHEN** запрос пришёл с `Origin: http://localhost:9876` или `http://localhost:8765`
- **THEN** ответ `403`

## MODIFIED Requirements

### Requirement: Формат адреса

Прокси SHALL принимать адреса вида `/<схема>/<хост>/<путь>?<запрос>` и запрашивать `<схема>://<хост>/<путь>?<запрос>`, где схема — `http` или `https`. Прочие адреса, в том числе `/wikimapia/<путь>` старого клиента, SHALL получать `404`.

#### Scenario: Запрос через прокси

- **WHEN** разрешённая страница запрашивает `/https/www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4`
- **THEN** прокси запрашивает `https://www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4` и возвращает ответ

#### Scenario: Неизвестный путь

- **WHEN** запрошен `/ftp/example.com/file` или `/wikimapia/z1/itiles/0/1/2.xy`
- **THEN** ответ `404`

### Requirement: Фильтрация заголовков

К сервису SHALL уходить только заголовки `Accept`, `Accept-Language`, `Content-Type`, `Range` и `User-Agent`. `Set-Cookie` из ответа сервиса SHALL удаляться.

#### Scenario: Куки сервиса

- **WHEN** сервис ставит куку в ответе
- **THEN** клиент не получает `Set-Cookie`

#### Scenario: User-Agent клиента

- **WHEN** браузер запрашивает через прокси файл трека или короткую ссылку
- **THEN** сервис получает `User-Agent` браузера, а не пустой заголовок

## REMOVED Requirements

### Requirement: Только разрешённые origin

**Reason**: Список разрешённых origin описывал старый клиент: его dev-серверы 8765 и 8766 и karma на 9876, тесты которой ходили в живые сервисы через прокси; клиента и karma больше нет.

**Migration**: Требование «Разрешённые origin клона»: сайт клона и dev-серверы приложения 8769 и 4173.
