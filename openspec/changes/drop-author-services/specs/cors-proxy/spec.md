# Spec Delta

## MODIFIED Requirements

### Requirement: Формат адреса

Прокси SHALL принимать адреса вида `/<схема>/<хост>/<путь>?<запрос>` и запрашивать `<схема>://<хост>/<путь>?<запрос>`, где схема — `http` или `https`. Адрес `/wikimapia/<путь>` SHALL вести на `http://wikimapia.org/<путь>`. Адрес `/mapy/<слой>/<путь>` SHALL вести на эндпоинт тайлов mapy.cz для известного слоя с ключом API из секретов прокси, не раскрывая ключ клиенту. Прочие адреса SHALL получать `404`.

#### Scenario: Запрос через прокси

- **WHEN** разрешённая страница запрашивает `/https/www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4`
- **THEN** прокси запрашивает `https://www.openstreetmap.org/api/0.6/map?bbox=1,2,3,4` и возвращает ответ

#### Scenario: Неизвестный путь

- **WHEN** запрошен `/ftp/example.com/file`
- **THEN** ответ `404`

#### Scenario: Тайл mapy.cz

- **WHEN** разрешённая страница запрашивает `/mapy/turist-en/12-2286-1471`
- **THEN** прокси возвращает тайл mapy.cz, ключ API не виден ни в ответе, ни в адресе клиента

#### Scenario: Неизвестный слой mapy.cz

- **WHEN** запрошен `/mapy/unknown/1-1-1`
- **THEN** ответ `404`
