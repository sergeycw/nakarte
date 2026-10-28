## MODIFIED Requirements

### Requirement: Превью подложек справа

Справа сверху над кнопками карты приложение SHALL показывать три круглых превью подложек — Tracestrack Topo, Google Map и ESRI Satellite, по одной на тип (топокарта, обычная карта, спутник), даже если подложка скрыта в Configure layers. Нажатие на превью SHALL выбирать подложку, выбранная SHALL быть отмечена; при подложке не из трёх не отмечено ни одно. Превью SHALL NOT запрашивать тайлы: картинки — из сборки. Название — подсказкой и в `aria-label`.

#### Scenario: Подложка по превью

- **WHEN** пользователь нажимает превью «ESRI Satellite»
- **THEN** подложка — ESRI Satellite, превью отмечено, в адресе `l=E`

#### Scenario: Превью без настроек

- **WHEN** приложение открыто без настроек слоёв
- **THEN** в превью — Tracestrack Topo, Google Map и ESRI Satellite, отмечено Tracestrack Topo

#### Scenario: Выбранная подложка вне превью

- **WHEN** выбрана подложка «Google Terrain»
- **THEN** в превью — Tracestrack Topo, Google Map и ESRI Satellite, ни одно не отмечено

#### Scenario: Скрытая подложка в превью

- **WHEN** «Google Map» скрыта в Configure layers
- **THEN** превью «Google Map» на месте, нажатие на него выбирает подложку

#### Scenario: Превью без запросов тайлов

- **WHEN** приложение открыто по адресу с `l=O`
- **THEN** три превью видны, тайлы Tracestrack Topo, Google Map и ESRI Satellite не запрашиваются

### Requirement: Порядок подложек по умолчанию

В группе `Default layers` подложка «OpenFreeMap Outdoor» (`Of`) SHALL идти сразу после «Tracestrack Topo», «ESRI Satellite» — сразу после «OpenStreetMap», а «CyclOSM» — после «Satellite by date».

#### Scenario: Подложки по умолчанию по порядку

- **WHEN** пользователь открывает полный список слоёв без настроек
- **THEN** подложки идут так: Tracestrack Topo, OpenFreeMap Outdoor, OpenStreetMap, ESRI Satellite, Sentinel-2 cloudless, Satellite by date, CyclOSM

## REMOVED Requirements

### Requirement: Подписи под превью подложек

**Reason**: Три превью разного типа различаются картинкой, подписи не нужны (владелец 2026-10-28).

**Migration**: Короткие имена подложек удалены; полное название — подсказкой и в `aria-label`, как раньше.
