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

### Requirement: Авторские бэкенды высот и треков

Клон SHALL использовать авторские `elevation.nakarte.me` и `tracks.nakarte.me`: они отвечают чужому origin, а ссылки на треки живут в хранилище автора.

#### Scenario: Высоты в клоне

- **WHEN** пользователь клона открывает профиль высот трека
- **THEN** высоты приходят с `elevation.nakarte.me`

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
