# Spec Delta

## Purpose

Защита Worker'ов клона (`nakarte-elevation`, `nakarte-tracks`, `nakarte-cors-proxy`) от перерасхода на Cloudflare: потолок ресурсов на один вызов и частота запросов с одного IP.

## ADDED Requirements

### Requirement: Частота запросов с одного IP

Каждый Worker клона SHALL ограничивать число запросов с одного IP-адреса клиента за окно 60 секунд: тайлы высот (`/tiles/` у `nakarte-elevation`) — 600, API высот (прочие пути `nakarte-elevation`) — 60, хранилище треков — 60, CORS-прокси — 1200. Учёт SHALL вестись отдельно для каждой группы и допускает приблизительность платформы (счёт по локациям Cloudflare, без точной синхронизации).

#### Scenario: Превышение лимита тайлов

- **WHEN** с одного IP за минуту пришло больше 600 запросов тайлов высот
- **THEN** лишние запросы получают `429`, запросы к API высот с того же IP считаются отдельно

#### Scenario: Запрос без IP клиента

- **WHEN** у запроса нет IP клиента (локальный `wrangler dev`, тестовый стенд)
- **THEN** частота не ограничивается

### Requirement: Ответ при превышении частоты

Запрос сверх лимита SHALL получать `429` с телом `Too many requests\n`, заголовком `Retry-After: 60` и теми же CORS-заголовками, что ответ сервиса на этот путь: `Access-Control-Allow-Origin: *` у тайлов высот, отражённый разрешённый `Origin` с `Access-Control-Allow-Credentials: true` у API высот, треков и прокси. Запрос с неразрешённым `Origin` к сервису со списком origin SHALL получать `403`, как без лимита.

#### Scenario: Клиент видит ошибку, а не сбой CORS

- **WHEN** клон на `https://nakarte-routing.pages.dev` превысил лимит хранилища треков
- **THEN** ответ `429` содержит `Access-Control-Allow-Origin: https://nakarte-routing.pages.dev`, и браузер отдаёт клиенту статус

### Requirement: Потолок ресурсов на вызов

Один вызов Worker'а SHALL прерываться платформой при превышении потолка: `nakarte-elevation` — 10 секунд CPU, `nakarte-tracks` и `nakarte-cors-proxy` — 500 мс CPU; подзапросов — 10 у `nakarte-tracks` и 50 у `nakarte-cors-proxy`. У `nakarte-elevation` потолок подзапросов SHALL оставаться платформенным по умолчанию, чтобы запрос на 10 000 точек вразброс не ломался.

#### Scenario: Зависший запрос

- **WHEN** вызов `nakarte-tracks` расходует больше 500 мс CPU
- **THEN** платформа прерывает его с ошибкой, а не досчитывает до 30 секунд
