## MODIFIED Requirements

### Requirement: Каталог слоёв

Приложение SHALL предлагать слои старого клиента с теми же кодами, названиями и группами, кроме Yandex map (`Y`), Yandex Satellite (`S`), Wikimapia (`W`) и Soviet topo maps grid (`Ng`), и SHALL добавлять оверлеи «Relief shading» (`Hs`) и «Contour lines» (`Ct`), подложку «Tracestrack Topo» (`Tt`, первой в группе `Default layers`) и подложку «Sentinel-2 cloudless» (`S2`, сразу после «ESRI Satellite»). Каждый показанный слой SHALL иметь свою атрибуцию в подписи карты.

#### Scenario: Список слоёв

- **WHEN** пользователь открывает настройку списка слоёв
- **THEN** в ней 34 слоя по группам старого клиента, первый — «Tracestrack Topo», слоёв Яндекса, Wikimapia и сетки советских топокарт нет

#### Scenario: Атрибуция слоя

- **WHEN** включён оверлей «Waymarked Hiking Trails» поверх OpenStreetMap
- **THEN** в подписи карты есть атрибуция обоих слоёв

#### Scenario: Атрибуция Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** в подписи карты — подпись из условий Tracestrack «Data: © OpenStreetMap contributors, SRTM, GEBCO, SONNY's LiDAR DTM, NASADEM, ESA WorldCover; Maps © Tracestrack», где «Maps © Tracestrack» — ссылка на `https://www.tracestrack.com/`, а «© OpenStreetMap contributors» — на `https://www.openstreetmap.org/copyright`

## ADDED Requirements

### Requirement: Горизонтали

Оверлей «Contour lines» (`Ct` в `l=`) SHALL рисовать горизонтали, построенные в браузере по тем же данным AWS Terrain Tiles, что и «Relief shading», с шагом, который мельчает с зумом; основные горизонтали SHALL быть толще и подписаны высотой в метрах. Слой SHALL лежать над отмывкой рельефа и показывать атрибуцию Terrain Tiles. На зуме ниже 11 (`m=` адреса) горизонтали SHALL не строиться, а данные рельефа ради них SHALL не запрашиваться.

#### Scenario: Горизонтали из рельефа

- **WHEN** приложение открыто по адресу с `l=O/Ct` на зуме 14 (`m=14`) над склоном
- **THEN** на карте горизонтали через 20 м, каждая пятая — основная, с подписью высоты; рельеф запрошен у AWS Terrain Tiles, в подписи карты — ссылка на атрибуцию Terrain Tiles

#### Scenario: Горизонтали над отмывкой

- **WHEN** включены «Contour lines» и «Relief shading»
- **THEN** горизонтали лежат над отмывкой и под тепловой картой Strava

#### Scenario: Горизонтали на мелком зуме

- **WHEN** приложение открыто по адресу с `l=O/Ct` на зуме 10 (`m=10`)
- **THEN** горизонталей нет, рельеф у AWS Terrain Tiles не запрашивается
