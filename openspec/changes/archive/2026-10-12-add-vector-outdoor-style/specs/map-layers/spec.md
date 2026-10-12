# Spec Delta

## MODIFIED Requirements

### Requirement: Каталог слоёв

Приложение SHALL предлагать слои старого клиента с теми же кодами, названиями и группами, кроме Yandex map (`Y`), Yandex Satellite (`S`), Wikimapia (`W`) и Soviet topo maps grid (`Ng`), и SHALL добавлять оверлеи «Relief shading» (`Hs`) и «Contour lines» (`Ct`), подложку «Tracestrack Topo» (`Tt`, первой в группе `Default layers`), подложки «Sentinel-2 cloudless» (`S2`) и «Satellite by date» (`Hls`) сразу после «ESRI Satellite». Каждый показанный слой SHALL иметь свою атрибуцию в подписи карты.

#### Scenario: Список слоёв

- **WHEN** пользователь открывает настройку списка слоёв
- **THEN** в ней 36 слоёв по группам старого клиента, первые — «Tracestrack Topo», «OpenFreeMap Outdoor», «OpenStreetMap», «ESRI Satellite»; слоёв Яндекса, Wikimapia и сетки советских топокарт нет

#### Scenario: Атрибуция слоя

- **WHEN** включён оверлей «Waymarked Hiking Trails» поверх OpenStreetMap
- **THEN** в подписи карты есть атрибуция обоих слоёв

#### Scenario: Атрибуция Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** в подписи карты — подпись из условий Tracestrack «Data: © OpenStreetMap contributors, SRTM, GEBCO, SONNY's LiDAR DTM, NASADEM, ESA WorldCover; Maps © Tracestrack», где «Maps © Tracestrack» — ссылка на `https://www.tracestrack.com/`, а «© OpenStreetMap contributors» — на `https://www.openstreetmap.org/copyright`

### Requirement: Превью подложек справа

Справа сверху над кнопками карты приложение SHALL показывать круглые превью первых четырёх подложек списка слоёв в порядке каталога, кроме «Satellite by date» (у неё своя кнопка); выбранная подложка, если её среди них нет и это не «Satellite by date», SHALL быть четвёртой. Нажатие на превью SHALL выбирать подложку, выбранная SHALL быть отмечена. Превью SHALL NOT запрашивать тайлы: картинка — из сборки, подложка без картинки — круг с буквами названия. Название — подсказкой и в `aria-label`.

#### Scenario: Подложка по превью

- **WHEN** пользователь нажимает превью «ESRI Satellite»
- **THEN** подложка — ESRI Satellite, превью отмечено, в адресе `l=E`

#### Scenario: Превью без настроек

- **WHEN** приложение открыто без настроек слоёв
- **THEN** в превью — Tracestrack Topo, OpenFreeMap Outdoor, OpenStreetMap и ESRI Satellite

#### Scenario: Выбранная подложка вне превью

- **WHEN** выбрана подложка «Google Terrain»
- **THEN** в превью — Tracestrack Topo, OpenFreeMap Outdoor, OpenStreetMap и Google Terrain

#### Scenario: Превью без запросов тайлов

- **WHEN** приложение открыто по адресу с `l=O`
- **THEN** превью четырёх подложек видны, тайлы Tracestrack Topo и ESRI Satellite не запрашиваются, к `tiles.openfreemap.org` запросов нет

## ADDED Requirements

### Requirement: Порядок подложек по умолчанию

В группе `Default layers` подложка «OpenFreeMap Outdoor» (`Of`) SHALL идти сразу после «Tracestrack Topo», «ESRI Satellite» — сразу после «OpenStreetMap», а «CyclOSM» — после «Satellite by date», чтобы первые четыре подложки списка были Tracestrack Topo, OpenFreeMap Outdoor, OpenStreetMap и ESRI Satellite.

#### Scenario: Подложки по умолчанию по порядку

- **WHEN** пользователь открывает полный список слоёв без настроек
- **THEN** подложки идут так: Tracestrack Topo, OpenFreeMap Outdoor, OpenStreetMap, ESRI Satellite, Sentinel-2 cloudless, Satellite by date, CyclOSM

### Requirement: Подложка OpenFreeMap Outdoor

Подложка «OpenFreeMap Outdoor» (`Of` в `l=`) SHALL рисовать свой туристический векторный стиль по тайлам OpenFreeMap, запрашивая описание тайлов и тайлы напрямую у `tiles.openfreemap.org`, без шрифтов и значков с других адресов. Тропы и грунтовки SHALL отличаться от дорог, вершины и перевалы SHALL подписываться высотой в метрах. Подпись карты SHALL называть OpenFreeMap, OpenMapTiles и OpenStreetMap.

#### Scenario: Ссылка с OpenFreeMap Outdoor

- **WHEN** приложение открыто по адресу с `l=Of`
- **THEN** включена подложка «OpenFreeMap Outdoor», описание тайлов и тайлы запрошены у `tiles.openfreemap.org`, других внешних запросов ради подложки нет, тайлы Tracestrack Topo не запрашиваются, в адресе `l=Of`

#### Scenario: Атрибуция OpenFreeMap

- **WHEN** включена подложка «OpenFreeMap Outdoor»
- **THEN** в подписи карты — «OpenFreeMap © OpenMapTiles Data from OpenStreetMap» со ссылками на `https://openfreemap.org`, `https://www.openmaptiles.org/` и `https://www.openstreetmap.org/copyright`

#### Scenario: Вершина с высотой

- **WHEN** на карте с «OpenFreeMap Outdoor» видна вершина Казбек
- **THEN** под её названием — высота «5054 m»

### Requirement: Подписи OpenFreeMap Outdoor

Подписи подложки «OpenFreeMap Outdoor» SHALL показывать местное название, а под ним — название на языке браузера или, если его нет, латиницей; совпадающая вторая строка SHALL не показываться. Подписи SHALL строиться так на любом зуме.

#### Scenario: Браузер на русском в Грузии

- **WHEN** язык браузера — `ru-RU`, на карте Степанцминда, у которой есть название по-русски
- **THEN** подпись — «სტეფანწმინდა» и под ней «Степанцминда»

#### Scenario: Нет перевода на язык браузера

- **WHEN** у места «სტეფანწმინდა» нет названия на языке браузера, а латиницей оно «Stepantsminda»
- **THEN** подпись — «სტეფანწმინდა» и под ней «Stepantsminda»

#### Scenario: Название уже на языке браузера

- **WHEN** язык браузера — `ru-RU`, а местное название — «Верхний Ларс» и по-русски так же, или язык браузера — `ka-GE`, а название грузинское
- **THEN** подпись — одна строка с местным названием

#### Scenario: Подписи на крупном зуме

- **WHEN** приложение открыто с `l=Of` на зуме 15 (`m=15`) в Тбилиси
- **THEN** названия улиц и районов подписаны в две строки, как на мелком зуме
