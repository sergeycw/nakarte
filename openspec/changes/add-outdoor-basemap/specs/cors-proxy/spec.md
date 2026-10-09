## ADDED Requirements

### Requirement: Ключ Tracestrack

Для растровых тайлов Tracestrack Topo (`/https/tile.tracestrack.com/topo__/<z>/<x>/<y>.webp` и `…@2x.webp`) прокси SHALL отбрасывать запрос клиента после пути и запрашивать тайл с единственным параметром `key` из секрета `TRACESTRACK_KEY`. Без секрета прокси SHALL отвечать `503` с CORS-заголовками, не обращаясь к Tracestrack. Ключ SHALL NOT уходить на другие адреса и SHALL NOT попадать в ответ клиенту, в том числе в `Location`.

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

- **WHEN** запрошен `/https/tile.tracestrack.com/topo_ru/10/618/377.png` или `/https/api.tracestrack.com/…`
- **THEN** запрос уходит без ключа из секрета

#### Scenario: Редирект Tracestrack

- **WHEN** Tracestrack отвечает на тайл редиректом, в `Location` которого есть ключ
- **THEN** клиент получает `Location` через прокси без параметра `key`
