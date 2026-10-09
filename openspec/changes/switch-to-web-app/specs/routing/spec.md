## MODIFIED Requirements

### Requirement: Доступность и подсказка по движку

Кнопка прокладки SHALL показываться, если движку есть где считать: движку в браузере сервер не нужен, серверному нужен `routingServer`. Подсказка о недоступном роутере SHALL говорить, что делать, для своего движка: в серверном режиме — запустить BRouter командой `docker compose up -d`, в браузере — перезагрузить страницу.

#### Scenario: Клон без сервера-роутера

- **WHEN** `routingEngine` равен `'browser'`, а `routingServer` пустой
- **THEN** кнопка прокладки показывается

#### Scenario: Движок в браузере не запустился

- **WHEN** `routingEngine` равен `'browser'` и движок не запустился
- **THEN** отрезок прямой, кнопка красная
- **AND** подсказка предлагает перезагрузить страницу и не упоминает `docker compose`

#### Scenario: Серверный BRouter не запущен

- **WHEN** `routingEngine` равен `'server'`, а BRouter не отвечает
- **THEN** подсказка — `BRouter is not running, start it with docker compose up -d`
