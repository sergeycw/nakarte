## ADDED Requirements

### Requirement: Ключ Tracestrack

Для растровых тайлов Tracestrack Topo (`/https/tile.tracestrack.com/topo__/<z>/<x>/<y>.webp` и `…@2x.webp`, только https на стандартный порт) прокси SHALL отбрасывать запрос клиента после пути и запрашивать тайл с единственным параметром `key` из секрета `TRACESTRACK_KEY`. Без секрета прокси SHALL отвечать `503` с CORS-заголовками, не обращаясь к Tracestrack. На другие адреса ключ SHALL NOT уходить.

#### Scenario: Тайл Tracestrack

- **WHEN** разрешённая страница запрашивает `/https/tile.tracestrack.com/topo__/10/618/377.webp`
- **THEN** прокси запрашивает `https://tile.tracestrack.com/topo__/10/618/377.webp?key=<секрет>` и возвращает тайл

#### Scenario: Ключ клиента не проходит

- **WHEN** запрошен `/https/tile.tracestrack.com/topo__/10/618/377.webp?key=other&x=1`
- **THEN** к Tracestrack уходит только `key` из секрета

#### Scenario: Ключ не задан

- **WHEN** секрета `TRACESTRACK_KEY` нет и запрошен тайл Tracestrack Topo
- **THEN** ответ `503` с `Access-Control-Allow-Origin` разрешённой страницы, запроса к Tracestrack нет

#### Scenario: Другой адрес Tracestrack

- **WHEN** запрошен `/https/tile.tracestrack.com/topo_ru/10/618/377.png`, `/https/api.tracestrack.com/…`, `/http/tile.tracestrack.com/topo__/…` или адрес с другим портом
- **THEN** запрос уходит без ключа из секрета

### Requirement: Ключ Tracestrack не уходит клиенту

Ответ на тайл Tracestrack Topo SHALL NOT содержать ключ: заголовки ответа SHALL проходить по белому списку (`Content-Type`, `Cache-Control`, `ETag`, `Last-Modified`, `Expires`), `Location` — без параметра `key`, а тело ответа не `2xx` SHALL заменяться на `Tracestrack error <статус>`.

#### Scenario: Редирект Tracestrack

- **WHEN** Tracestrack отвечает на тайл редиректом, в `Location` которого есть ключ
- **THEN** клиент получает `Location` через прокси без параметра `key`

#### Scenario: Отказ Tracestrack

- **WHEN** Tracestrack отвечает на тайл `403` с ключом в теле или заголовках
- **THEN** клиент получает `403` с телом `Tracestrack error 403` и без ключа в заголовках

### Requirement: Кеш тайлов Tracestrack

Если Tracestrack отдал тайл `200` без `Cache-Control`, прокси SHALL ставить `Cache-Control: public, max-age=86400`, чтобы повторный заход браузера не тратил квоту. Свой `Cache-Control` Tracestrack SHALL проходить как есть.

#### Scenario: Кеш тайла

- **WHEN** Tracestrack отдаёт тайл `200` без `Cache-Control`
- **THEN** клиент получает `Cache-Control: public, max-age=86400`
