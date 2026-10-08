## MODIFIED Requirements

### Requirement: Деплой на каждый push в master

Каждый push в `master` репозитория `sergeycw/nakarte` SHALL выкатывать сервисы, чьи файлы изменились с коммита последнего успешного прогона деплоя: сайт с Pages Functions — в Pages-проект `nakarte-routing` (production-ветка `master`), Worker'ы `nakarte-cors-proxy`, `nakarte-tracks`, `nakarte-elevation` — из своих каталогов `workers/<сервис>/`. Изменения только в документах (`docs/`, `openspec/`, `*.md`), тестах karma и других workflow SHALL ничего не выкатывать. Ручной запуск, изменение самого workflow деплоя или неизвестная база сравнения SHALL выкатывать всё. В других репозиториях деплой SHALL пропускаться.

#### Scenario: Слияние PR в master

- **WHEN** PR с изменениями клиента влит в `master` форка
- **THEN** через один прогон workflow «deploy pages» на `https://nakarte-routing.pages.dev` работает новая сборка

#### Scenario: Правка только документации

- **WHEN** в `master` пришёл push, который меняет только `docs/` и `openspec/`
- **THEN** ни Pages, ни Worker'ы не выкатываются, изоляты Worker'ов не перезапускаются

#### Scenario: Правка одного Worker'а

- **WHEN** push меняет только `workers/tracks/`
- **THEN** выкатывается только `nakarte-tracks`

#### Scenario: Push в апстрим или чужой форк

- **WHEN** workflow срабатывает не в `sergeycw/nakarte`
- **THEN** задание пропускается без обращения к Cloudflare

### Requirement: Последний push побеждает

Если во время деплоя пришёл новый push, незаконченный деплой SHALL отменяться, и публиковаться SHALL последняя версия `master`. Изменения отменённого или упавшего прогона SHALL выкатываться следующим прогоном.

#### Scenario: Два push подряд

- **WHEN** второй push пришёл, пока первый деплой ещё идёт
- **THEN** первый прогон отменён, в проде сборка второго

#### Scenario: Отменённый прогон менял Worker

- **WHEN** прогон с изменением `workers/elevation/` отменён следующим push, который меняет только документацию
- **THEN** следующий прогон выкатывает `nakarte-elevation`

### Requirement: Бандл без адресов автора

Деплой SHALL после сборки проверять бандл скриптом `scripts/check-no-author-hosts.mjs` и SHALL падать до публикации, если в текстовых файлах сборки есть адрес `nakarte.me` или его поддомена вне списка известных строк-метаданных (`<title>`, `creator` в GPX, имя файла JNX, текст уведомления сессий). Та же проверка SHALL идти на каждом PR, который меняет не только документы.

#### Scenario: Адрес автора в бандле

- **WHEN** в собранном бандле есть `https://proxy.nakarte.me/`
- **THEN** скрипт печатает вхождение с контекстом, workflow падает до шага публикации, прод не меняется

#### Scenario: Адрес автора в PR

- **WHEN** PR добавляет в клиент адрес `*.nakarte.me`
- **THEN** проверка `check clone` на PR красная до merge

#### Scenario: Чистый бандл

- **WHEN** в бандле только строки-метаданные `nakarte.me`
- **THEN** проверка проходит, деплой продолжается

## ADDED Requirements

### Requirement: Тесты сервиса перед его деплоем

Деплой каждого Worker'а SHALL идти после тестов этого сервиса на том же коммите, а публикация Pages — после тестов Pages Functions. Упавшие тесты SHALL останавливать деплой этого сервиса.

#### Scenario: Тест Worker'а упал

- **WHEN** в `master` попал коммит, на котором тесты `workers/tracks` красные
- **THEN** `nakarte-tracks` не выкатывается, прод остаётся на прежней версии

### Requirement: Worker'ы раньше Pages

Если в одном прогоне выкатываются Worker'ы и Pages, Pages SHALL публиковаться после успешного деплоя Worker'ов. Упавший деплой Worker'а SHALL останавливать публикацию Pages.

#### Scenario: Смена контракта сервиса и клиента одним PR

- **WHEN** PR меняет `workers/elevation/` и клиент
- **THEN** новый клиент появляется на `nakarte-routing.pages.dev` только после того, как выкачен новый `nakarte-elevation`
