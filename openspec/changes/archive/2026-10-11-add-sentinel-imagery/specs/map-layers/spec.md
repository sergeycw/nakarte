## MODIFIED Requirements

### Requirement: Каталог слоёв

Приложение SHALL предлагать слои старого клиента с теми же кодами, названиями и группами, кроме Yandex map (`Y`), Yandex Satellite (`S`), Wikimapia (`W`) и Soviet topo maps grid (`Ng`), и SHALL добавлять оверлей «Relief shading» (`Hs`), подложку «Tracestrack Topo» (`Tt`, первой в группе `Default layers`) и подложку «Sentinel-2 cloudless» (`S2`, сразу после «ESRI Satellite»). Каждый показанный слой SHALL иметь свою атрибуцию в подписи карты.

#### Scenario: Список слоёв

- **WHEN** пользователь открывает настройку списка слоёв
- **THEN** в ней 33 слоя по группам старого клиента, первый — «Tracestrack Topo», слоёв Яндекса, Wikimapia и сетки советских топокарт нет

#### Scenario: Атрибуция слоя

- **WHEN** включён оверлей «Waymarked Hiking Trails» поверх OpenStreetMap
- **THEN** в подписи карты есть атрибуция обоих слоёв

#### Scenario: Атрибуция Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** в подписи карты — подпись из условий Tracestrack «Data: © OpenStreetMap contributors, SRTM, GEBCO, SONNY's LiDAR DTM, NASADEM, ESA WorldCover; Maps © Tracestrack», где «Maps © Tracestrack» — ссылка на `https://www.tracestrack.com/`, а «© OpenStreetMap contributors» — на `https://www.openstreetmap.org/copyright`

## ADDED Requirements

### Requirement: Подложка Sentinel-2 cloudless

Подложка «Sentinel-2 cloudless» SHALL показывать годовую мозаику EOX Sentinel-2 cloudless, загружая тайлы напрямую с `tiles.maps.eox.at` без CORS-прокси, и SHALL выбираться кодом `S2` в `l=`. Подпись карты SHALL содержать текст из условий EOX с годом мозаики и ссылку на лицензию CC BY-NC-SA 4.0.

#### Scenario: Ссылка с Sentinel-2

- **WHEN** приложение открыто по адресу с `l=S2`
- **THEN** включена подложка «Sentinel-2 cloudless», её тайлы запрашиваются у `tiles.maps.eox.at`, тайлы Tracestrack Topo не запрашиваются, в адресе `l=S2`

#### Scenario: Атрибуция Sentinel-2

- **WHEN** включена подложка «Sentinel-2 cloudless»
- **THEN** в подписи карты — «EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data <год мозаики>), CC BY-NC-SA 4.0», где адрес — ссылка на себя, а «CC BY-NC-SA 4.0» — на `https://creativecommons.org/licenses/by-nc-sa/4.0/`
