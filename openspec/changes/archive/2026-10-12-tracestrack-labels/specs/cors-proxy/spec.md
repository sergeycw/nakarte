## MODIFIED Requirements

### Requirement: Ключ Tracestrack

Для растровых тайлов Tracestrack Topo (`/https/tile.tracestrack.com/topo_<язык>/<z>/<x>/<y>.webp` и `…@2x.webp`, где `<язык>` — язык из списка Tracestrack или `_`, только https на стандартный порт) прокси SHALL отбрасывать запрос клиента после пути и запрашивать тайл с единственным параметром `key` из секрета `TRACESTRACK_KEY`. Без секрета прокси SHALL отвечать `503` с CORS-заголовками, не обращаясь к Tracestrack. На другие адреса ключ SHALL NOT уходить.

#### Scenario: Тайл Tracestrack

- **WHEN** разрешённая страница запрашивает `/https/tile.tracestrack.com/topo_en/10/618/377.webp`, `…/topo_ru/…` или `…/topo__/…`
- **THEN** прокси запрашивает тот же тайл у `https://tile.tracestrack.com/` с `?key=<секрет>` и возвращает его

#### Scenario: Ключ клиента не проходит

- **WHEN** запрошен `/https/tile.tracestrack.com/topo_en/10/618/377.webp?key=other&x=1`
- **THEN** к Tracestrack уходит только `key` из секрета

#### Scenario: Ключ не задан

- **WHEN** секрета `TRACESTRACK_KEY` нет и запрошен тайл Tracestrack Topo
- **THEN** ответ `503` с `Access-Control-Allow-Origin` разрешённой страницы, запроса к Tracestrack нет

#### Scenario: Другой адрес Tracestrack

- **WHEN** запрошен `/https/tile.tracestrack.com/topo_ru/10/618/377.png`, `…/topo_ka/10/618/377.webp` (языка нет у Tracestrack), `/https/api.tracestrack.com/…`, `/http/tile.tracestrack.com/topo__/…` или адрес с другим портом
- **THEN** запрос уходит без ключа из секрета
