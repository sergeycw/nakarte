# clone-hosting Specification

## Purpose

Публичный клон nakarte на Cloudflare (`nakarte-routing.pages.dev`): сборка под клон, раздача тайлов BRouter и файлов движка с того же origin, отказ от авторских сервисов там, где они не пускают чужой домен.

## Requirements

### Requirement: Сборка под клон

Сборка с `NAKARTE_TARGET=clone` SHALL включать движок в браузере по умолчанию, брать тайлы из `/tiles/`, ходить через свой CORS-прокси (и для Wikimapia), не отправлять события на `nakarte.me/event` и не включать Sentry. Сборка без цели SHALL вести себя как апстрим.

#### Scenario: Сборка клона

- **WHEN** приложение собрано с `NAKARTE_TARGET=clone`
- **THEN** `routingEngine` равен `'browser'`, `routingTilesPath` — `'/tiles/'`, `CORSProxyUrl` указывает на `nakarte-cors-proxy.nakarte-routing.workers.dev`
- **AND** запросов на `https://nakarte.me/event` и в Sentry нет

### Requirement: Тайлы BRouter на том же origin

Клон SHALL отдавать тайлы `.rd5` по `/tiles/<имя>.rd5` из бакета R2 `nakarte-tiles`. Ответ SHALL поддерживать `HEAD` и Range-запросы: `206` с `Content-Range` на корректный диапазон, `416` на некорректный, `404` на отсутствующий тайл. Тайлы SHALL кешироваться на сутки.

#### Scenario: Range-запрос

- **WHEN** клиент запрашивает `/tiles/E40_N40.rd5` с `Range: bytes=0-0`
- **THEN** ответ `206` с `Content-Range: bytes 0-0/<размер>`

#### Scenario: Тайла нет в бакете

- **WHEN** маршрут прокладывается в районе, тайла которого нет в бакете
- **THEN** запрос тайла получает `404`, отрезок остаётся прямым с уведомлением об ошибке

### Requirement: Пустой storageconfig.txt

По `/tiles/storageconfig.txt` клон SHALL отдавать пустой файл со статусом `200`: движок читает его на каждый маршрут.

#### Scenario: Запрос storageconfig.txt

- **WHEN** движок запрашивает `/tiles/storageconfig.txt`
- **THEN** ответ `200` с пустым телом

### Requirement: Range для файлов движка

Файлы движка (`/brouter-wasm/*`: jar и профили) SHALL отдаваться с поддержкой Range: `206` и `Content-Range` на диапазон, `416` на диапазон за концом файла, полный файл без заголовка `Range`.

#### Scenario: Проверка Range

- **WHEN** выполняется `curl -r 0-0 https://nakarte-routing.pages.dev/brouter-wasm/lib/brouter.jar`
- **THEN** ответ `206` с заголовком `Content-Range`

### Requirement: Покрытие тайлами всего мира

Бакет тайлов клона SHALL содержать все тайлы из индекса `https://brouter.de/brouter/segments4/`, чтобы маршрут строился везде, где его строит brouter.de.

#### Scenario: Маршрут вне Грузии

- **WHEN** на `https://nakarte-routing.pages.dev` с активностью «Hiking» ставятся две точки в Альпах (тайл `E5_N45`)
- **THEN** отрезок прокладывается по тропам, а не остаётся прямым

#### Scenario: Сверка с индексом

- **WHEN** список тайлов индекса brouter.de сравнивается с ключами `*.rd5` в бакете
- **THEN** каждый тайл индекса есть в бакете с тем же размером

### Requirement: Своё хранилище треков

Клон SHALL сохранять и открывать ссылки `nktl=` через своё хранилище треков (capability `track-storage`), а не через `tracks.nakarte.me`.

#### Scenario: Copy link в клоне

- **WHEN** пользователь клона нажимает «Copy link» и открывает ссылку
- **THEN** запросы `POST` и `GET /track/{key}` уходят на Worker клона, а не на `tracks.nakarte.me`

### Requirement: Свой сервис высот

Клон SHALL получать высоты для профиля, экспорта и внешних карт от своего сервиса высот (capability `elevation-api`), а не от `elevation.nakarte.me`.

#### Scenario: Профиль высот в клоне

- **WHEN** пользователь клона открывает профиль высот трека
- **THEN** запрос высот уходит на сервис клона, запросов к `elevation.nakarte.me` нет

### Requirement: Атрибуция данных высот

Клон SHALL показывать атрибуцию данных высот, которой требуют условия viewfinderpanoramas.org: упоминание «Elevation data: viewfinderpanoramas.org (Jonathan de Ferranti)» со ссылкой на страницу источника `https://viewfinderpanoramas.org/dem3.html`.

#### Scenario: Атрибуция в интерфейсе

- **WHEN** пользователь клона открывает профиль высот
- **THEN** атрибуция viewfinderpanoramas со ссылкой видна

### Requirement: Свои тайлы высот

Клон SHALL брать тайлы высот для показа высоты под курсором у себя (capability `elevation-tiles`), а не с `tiles.nakarte.me/elevation`.

#### Scenario: Высота под курсором в клоне

- **WHEN** пользователь клона водит курсором по карте с включённым показом высоты
- **THEN** тайлы высот запрашиваются у клона, запросов к `tiles.nakarte.me/elevation` нет
