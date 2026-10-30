## MODIFIED Requirements

### Requirement: Каталог слоёв

Приложение SHALL предлагать слои старого клиента с теми же кодами, названиями и группами, кроме Yandex map (`Y`), Yandex Satellite (`S`), Wikimapia (`W`) и Soviet topo maps grid (`Ng`), и SHALL добавлять оверлеи «Relief shading» (`Hs`) и «Contour lines» (`Ct`), подложку «Tracestrack Topo» (`Tt`, первой в группе `Default layers`), подложки «Sentinel-2 cloudless» (`S2`) и «Satellite by date» (`Hls`) сразу после «ESRI Satellite». Каждый показанный слой SHALL иметь свою атрибуцию в подписи карты.

#### Scenario: Список слоёв

- **WHEN** пользователь открывает настройку списка слоёв
- **THEN** в ней 31 слой по группам старого клиента — 36 слоёв каталога без пяти кнопок столбца, первые — «Tracestrack Topo», «OpenStreetMap», «Sentinel-2 cloudless»; слоёв Яндекса, Wikimapia и сетки советских топокарт нет

#### Scenario: Атрибуция слоя

- **WHEN** включён оверлей «Waymarked Hiking Trails» поверх OpenStreetMap
- **THEN** в подписи карты есть атрибуция обоих слоёв

#### Scenario: Атрибуция Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** в подписи карты — подпись из условий Tracestrack «Data: © OpenStreetMap contributors, SRTM, GEBCO, SONNY's LiDAR DTM, NASADEM, ESA WorldCover; Maps © Tracestrack», где «Maps © Tracestrack» — ссылка на `https://www.tracestrack.com/`, а «© OpenStreetMap contributors» — на `https://www.openstreetmap.org/copyright`

### Requirement: Подложка по умолчанию

Без годного `l=` в адресе и без сохранённого выбора приложение SHALL показывать подложку OpenFreeMap Outdoor без оверлеев. `l=` и сохранённый выбор SHALL быть важнее умолчания, в том числе `l=O` старых ссылок и Tracestrack Topo, сохранённая до смены умолчания.

#### Scenario: Первый заход без настроек

- **WHEN** приложение открыто впервые без параметров в адресе
- **THEN** включена подложка OpenFreeMap Outdoor, оверлеев нет, в адресе `l=Of`, тайлы Tracestrack Topo не запрашиваются

#### Scenario: Старая ссылка с OpenStreetMap

- **WHEN** приложение открыто по адресу с `l=O`
- **THEN** включена подложка OpenStreetMap, тайлы OpenFreeMap и Tracestrack не запрашиваются

#### Scenario: Сохранённый выбор OpenStreetMap

- **WHEN** пользователь выбрал подложку OpenStreetMap, затем открыл `/` без параметров
- **THEN** включена подложка OpenStreetMap

#### Scenario: Tracestrack до смены умолчания

- **WHEN** у пользователя сохранён выбор Tracestrack Topo с прежних заходов, и он открывает `/` без параметров
- **THEN** включена подложка Tracestrack Topo

### Requirement: Откат подложки при ошибке тайлов

Если тайл или описание тайлов подложки OpenFreeMap Outdoor либо тайл подложки Tracestrack Topo не загрузился с любым ответом, кроме `404`, или без ответа, приложение SHALL показать вместо неё следующую подложку цепочки OpenFreeMap Outdoor → Tracestrack Topo → OpenStreetMap, оставить оверлеи и показать один тост `<подложка> is unavailable` с пояснением `Switched to <следующая подложка>` вместо тоста ошибки тайлов. Откат SHALL NOT менять выбор: в `l=` и в сохранённом выборе остаётся подложка, с которой начался откат, перезагрузка и следующий заход снова пробуют её.

#### Scenario: OpenFreeMap недоступен

- **WHEN** открыта подложка OpenFreeMap Outdoor, а описание её тайлов или её тайлы не загружаются
- **THEN** карта показывает Tracestrack Topo с прежними оверлеями, в адресе остаётся `l=Of`, виден тост `OpenFreeMap Outdoor is unavailable` с пояснением `Switched to Tracestrack Topo`, тоста `Map tiles failed to load` нет

#### Scenario: Недоступны обе

- **WHEN** после отката с OpenFreeMap Outdoor прокси отвечает на тайлы Tracestrack Topo `503`
- **THEN** карта показывает OpenStreetMap, в адресе остаётся `l=Of`, виден тост `Tracestrack Topo is unavailable`

#### Scenario: Нет ключа или квоты

- **WHEN** открыта подложка Tracestrack Topo, а прокси отвечает на её тайлы `503` или `403`
- **THEN** карта показывает OpenStreetMap с прежними оверлеями, в адресе остаётся `l=Tt` с оверлеями, виден тост `Tracestrack Topo is unavailable`, тоста `Map tiles failed to load` нет

#### Scenario: Следующий заход после отката

- **WHEN** после отката пользователь перезагружает вкладку или открывает `/` без параметров
- **THEN** приложение снова запрашивает подложку, с которой начался откат

#### Scenario: Выбор после отката

- **WHEN** после отката пользователь сам выбирает подложку «ESRI Satellite» (или «OpenStreetMap», или открывает ссылку с `l=O`) и открывает `/` без параметров
- **THEN** включена выбранная подложка

#### Scenario: Тайла нет

- **WHEN** сервер отвечает `404` на часть тайлов OpenFreeMap Outdoor или Tracestrack Topo
- **THEN** подложка остаётся прежней, тоста нет

### Requirement: Превью подложек справа

Справа сверху над кнопками карты приложение SHALL показывать три круга по типу подложек — топокарта, обычная карта, спутник — с картинками OpenFreeMap Outdoor, Google Map и ESRI Satellite, даже если подложка скрыта в Configure layers. Круг SHALL быть отмечен, когда выбрана подложка его группы; при подложке вне групп не отмечен ни один. Превью SHALL NOT запрашивать тайлы: картинки — из сборки. Название подложки, которую выберет нажатие, — подсказкой и в `aria-label`.

#### Scenario: Подложка по превью

- **WHEN** пользователь нажимает превью «ESRI Satellite»
- **THEN** подложка — ESRI Satellite, превью отмечено, в адресе `l=E`

#### Scenario: Превью без настроек

- **WHEN** приложение открыто без настроек слоёв
- **THEN** в превью — OpenFreeMap Outdoor, Google Map и ESRI Satellite, отмечено OpenFreeMap Outdoor

#### Scenario: Подложка группы отмечает круг

- **WHEN** выбрана подложка «Google Terrain»
- **THEN** отмечен круг обычной карты, его название — «Google Terrain»

#### Scenario: Выбранная подложка вне превью

- **WHEN** выбрана своя подложка
- **THEN** ни один круг не отмечен

#### Scenario: Скрытая подложка в превью

- **WHEN** «Google Map» скрыта в Configure layers
- **THEN** превью «Google Map» на месте, нажатие на него выбирает подложку

#### Scenario: Превью без запросов тайлов

- **WHEN** приложение открыто по адресу с `l=O`
- **THEN** три превью видны, тайлы OpenFreeMap Outdoor, Google Map и ESRI Satellite не запрашиваются

### Requirement: Настройка списка слоёв

Пользователь SHALL мочь скрыть или показать любой слой каталога в переключателе и вернуть список по умолчанию кнопкой «Reset». Кнопок столбца — первых слоёв групп и снимков по датам — в настройке SHALL NOT быть: они в столбце всегда. Слои групп SHALL быть в списке по умолчанию: галочка — их место в меню. Снятая галочка такого слоя без умолчания каталога в настройках, записанных раньше, — прежнее умолчание и SHALL NOT скрывать его.

#### Scenario: Скрыть слой из списка

- **WHEN** пользователь снимает «CyclOSM» в настройке списка и нажимает «Ok»
- **THEN** CyclOSM пропадает из меню топокарты и остаётся скрытым после перезагрузки

#### Scenario: Кнопок столбца в настройке нет

- **WHEN** пользователь открывает Configure layers без настроек
- **THEN** в нём нет OpenFreeMap Outdoor, Google Map, ESRI Satellite, «Strava heatmap (all)» и «Satellite by date»; Tracestrack Topo, OpenTopoMap и «Strava heatmap (run)» отмечены

#### Scenario: Слои меню отмечены по умолчанию

- **WHEN** настроек слоёв нет
- **THEN** OpenTopoMap и «Strava heatmap (run)» в списке, хотя в каталоге они не по умолчанию; Norway topo — нет

#### Scenario: Старые настройки галочек

- **WHEN** сохранённые настройки прежнего формата (или старого клиента) снимают OpenTopoMap, «Strava heatmap (run)» и CyclOSM
- **THEN** OpenTopoMap и «Strava heatmap (run)» в списке, CyclOSM скрыт

## RENAMED Requirements

- FROM: `### Requirement: Откат подложки Tracestrack на OpenStreetMap`
- TO: `### Requirement: Откат подложки при ошибке тайлов`
