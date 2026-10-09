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
- **THEN** в подписи карты есть «Maps © Tracestrack» со ссылкой на `https://www.tracestrack.com/` и © OpenStreetMap contributors

### Requirement: Подложка по умолчанию

Без годного `l=` в адресе и без сохранённого выбора приложение SHALL показывать подложку Tracestrack Topo без оверлеев. `l=` и сохранённый выбор SHALL быть важнее умолчания, в том числе `l=O` старых ссылок.

#### Scenario: Первый заход без настроек

- **WHEN** приложение открыто впервые без параметров в адресе
- **THEN** включена подложка Tracestrack Topo, оверлеев нет, в адресе `l=Tt`

#### Scenario: Старая ссылка с OpenStreetMap

- **WHEN** приложение открыто по адресу с `l=O`
- **THEN** включена подложка OpenStreetMap, тайлы Tracestrack не запрашиваются

#### Scenario: Сохранённый выбор OpenStreetMap

- **WHEN** пользователь выбрал подложку OpenStreetMap, затем открыл `/` без параметров
- **THEN** включена подложка OpenStreetMap

### Requirement: Слои через прокси

Слои Strava heatmap (`Sa`, `Sr`, `Sb`, `Sw`), Mountains by Aleksey Tsvetkov (`Mt`) и Tracestrack Topo (`Tt`) SHALL загружаться через CORS-прокси клона; остальные слои каталога SHALL загружаться напрямую с серверов провайдеров. Адреса тайлов Tracestrack в приложении SHALL NOT содержать ключ API.

#### Scenario: Слой Strava

- **WHEN** пользователь включает «Strava heatmap (all)»
- **THEN** тайлы запрашиваются у `nakarte-cors-proxy.nakarte-routing.workers.dev`, а не у `content-a.strava.com` напрямую

#### Scenario: Слой Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** тайлы запрашиваются у `nakarte-cors-proxy.nakarte-routing.workers.dev` по адресу `…/https/tile.tracestrack.com/topo__/…` без параметра `key`, а не у `tile.tracestrack.com` напрямую

## ADDED Requirements

### Requirement: Откат подложки Tracestrack на OpenStreetMap

Если тайл подложки Tracestrack Topo не загрузился с любым ответом, кроме `404`, или без ответа, приложение SHALL переключить подложку на OpenStreetMap, оставить оверлеи и показать один тост `Tracestrack Topo is unavailable` с пояснением `Switched to OpenStreetMap` вместо тоста ошибки тайлов. Откат SHALL NOT менять сохранённый выбор: следующий заход без `l=` снова начинается с Tracestrack Topo.

#### Scenario: Нет ключа или квоты

- **WHEN** открыта подложка Tracestrack Topo, а прокси отвечает на её тайлы `503` или `403`
- **THEN** карта показывает OpenStreetMap с прежними оверлеями, в адресе `l=O`, виден тост `Tracestrack Topo is unavailable`, тоста `Map tiles failed to load` нет

#### Scenario: Следующий заход после отката

- **WHEN** после отката пользователь открывает `/` без параметров
- **THEN** включена подложка Tracestrack Topo

#### Scenario: Выбор после отката

- **WHEN** после отката пользователь сам выбирает подложку «ESRI Satellite» и открывает `/` без параметров
- **THEN** включена ESRI Satellite

#### Scenario: Тайла нет

- **WHEN** прокси отвечает `404` на часть тайлов Tracestrack Topo
- **THEN** подложка остаётся Tracestrack Topo, тоста нет
