## MODIFIED Requirements

### Requirement: CORS-заголовки

Ответ SHALL содержать `Access-Control-Allow-Origin` с origin вызывающей страницы, `Access-Control-Allow-Credentials: true` и открывать наружу `Content-Disposition`. На `OPTIONS` прокси SHALL отвечать `204` с разрешёнными методами `GET, HEAD, OPTIONS` и запрошенными заголовками.

#### Scenario: Имя файла из Content-Disposition

- **WHEN** сервис отдаёт трек с `Content-Disposition: attachment; filename="run.gpx"`
- **THEN** страница может прочитать этот заголовок

## ADDED Requirements

### Requirement: Только чтение

Прокси SHALL обслуживать только `GET`, `HEAD` и `OPTIONS` и SHALL NOT пересылать сервису тело запроса. Другие методы SHALL получать `405` с CORS-заголовками.

#### Scenario: POST через прокси

- **WHEN** разрешённая страница отправляет `POST /https/example.com/login` с телом
- **THEN** ответ `405`, к `example.com` запрос не уходит

### Requirement: Свои адреса не проксируются

Запрос к своим адресам клона — `*.nakarte-routing.workers.dev`, `nakarte-routing.pages.dev` и его поддоменам — SHALL получать `403` без запроса к цели.

#### Scenario: Pages клона через прокси

- **WHEN** запрошен `/https/nakarte-routing.pages.dev/tiles/E40_N40.rd5`
- **THEN** ответ `403`, функция тайлов не вызывается
