# clone-deploy Specification

## Purpose
Автоматическая публикация клона nakarte на Cloudflare из ветки `master` форка, чтобы прод всегда совпадал с `master` и не выкатывался без файлов движка.

## Requirements

### Requirement: Деплой на каждый push в master

Каждый push в `master` репозитория `sergeycw/nakarte` SHALL собирать клон и публиковать сайт в Pages-проект `nakarte-routing` (production-ветка `master`) вместе с Pages Functions, а worker `nakarte-cors-proxy` — из `workers/cors-proxy`. Деплой SHALL запускаться и вручную. В других репозиториях деплой SHALL пропускаться.

#### Scenario: Слияние PR в master

- **WHEN** PR влит в `master` форка
- **THEN** через один прогон workflow «deploy pages» на `https://nakarte-routing.pages.dev` работает новая сборка

#### Scenario: Push в апстрим или чужой форк

- **WHEN** workflow срабатывает не в `sergeycw/nakarte`
- **THEN** задание пропускается без обращения к Cloudflare

### Requirement: Сборка без файлов движка не выкатывается

Деплой SHALL собирать файлы движка (jar BRouter, обёртку, патч и профили) из образа `ghcr.io/abrensch/brouter:nightly` и SHALL падать до публикации, если в сборке нет `brouter-wasm/lib/brouter.jar` или `brouter-wasm/profiles/lookups.dat`.

#### Scenario: Файлы движка не собрались

- **WHEN** jar не попал в `build/brouter-wasm/lib/`
- **THEN** workflow падает до шага публикации, прод не меняется

### Requirement: Сборка из шаблона секретов

Деплой SHALL собирать сайт с `src/secrets.js.template` и целью `NAKARTE_TARGET=clone`, без локальных секретов разработчика. Поле `google` скопированного `src/secrets.js` SHALL получать значение секрета `GOOGLE_MAPS_API_KEY`, а без секрета — пустую строку: Maps JavaScript API тогда работает в режиме без ключа, как на nakarte.me.

#### Scenario: Сборка в CI

- **WHEN** workflow собирает сайт
- **THEN** `src/secrets.js` скопирован из шаблона, а настройки клона берутся из `src/config-target/clone.js`

#### Scenario: Ключ Google заведён

- **WHEN** секрет `GOOGLE_MAPS_API_KEY` не пуст
- **THEN** Maps JavaScript API в собранном сайте загружается с этим ключом

#### Scenario: Без ключа Google

- **WHEN** секрета `GOOGLE_MAPS_API_KEY` нет
- **THEN** Maps JavaScript API загружается с пустым ключом, окно Street View показывает панораму с водяным знаком Google

### Requirement: Последний push побеждает

Если во время деплоя пришёл новый push, незаконченный деплой SHALL отменяться, и публиковаться SHALL последняя версия `master`.

#### Scenario: Два push подряд

- **WHEN** второй push пришёл, пока первый деплой ещё идёт
- **THEN** первый прогон отменён, в проде сборка второго
