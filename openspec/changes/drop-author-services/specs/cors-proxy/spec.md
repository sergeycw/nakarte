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
