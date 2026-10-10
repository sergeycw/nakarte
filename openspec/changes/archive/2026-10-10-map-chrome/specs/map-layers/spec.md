## MODIFIED Requirements

### Requirement: Каталог слоёв

Приложение SHALL предлагать слои старого клиента с теми же кодами, названиями и группами, кроме Yandex map (`Y`), Yandex Satellite (`S`), Wikimapia (`W`) и Soviet topo maps grid (`Ng`), и SHALL добавлять оверлей «Relief shading» (`Hs`) и подложку «Tracestrack Topo» (`Tt`, первой в группе `Default layers`). Каждый показанный слой SHALL иметь свою атрибуцию в подписи карты.

#### Scenario: Список слоёв

- **WHEN** пользователь открывает настройку списка слоёв
- **THEN** в ней 32 слоя по группам старого клиента, первый — «Tracestrack Topo», слоёв Яндекса, Wikimapia и сетки советских топокарт нет

#### Scenario: Атрибуция слоя

- **WHEN** включён оверлей «Waymarked Hiking Trails» поверх OpenStreetMap
- **THEN** в подписи карты есть атрибуция обоих слоёв

#### Scenario: Атрибуция Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** в подписи карты — подпись из условий Tracestrack «Data: © OpenStreetMap contributors, SRTM, GEBCO, SONNY's LiDAR DTM, NASADEM, ESA WorldCover; Maps © Tracestrack», где «Maps © Tracestrack» — ссылка на `https://www.tracestrack.com/`, а «© OpenStreetMap contributors» — на `https://www.openstreetmap.org/copyright`
