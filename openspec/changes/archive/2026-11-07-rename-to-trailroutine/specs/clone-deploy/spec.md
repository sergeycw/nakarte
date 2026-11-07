# Spec Delta

## MODIFIED Requirements

### Requirement: Деплой на каждый push в master

Каждый push в `master` репозитория `sergeycw/trailroutine` SHALL выкатывать сервисы, чьи файлы изменились с коммита последнего успешного прогона деплоя: сайт с Pages Functions — в Pages-проект `nakarte-routing`, Worker'ы — из своих каталогов `workers/<сервис>/`. Ручной запуск, изменение самого workflow деплоя или неизвестная база сравнения SHALL выкатывать всё. В других репозиториях деплой SHALL пропускаться.

#### Scenario: Слияние PR в master

- **WHEN** PR с изменениями приложения влит в `master`
- **THEN** через один прогон workflow «deploy pages» на `https://nakarte-routing.pages.dev` работает новая сборка

#### Scenario: Правка только документации

- **WHEN** в `master` пришёл push, который меняет только документы (`docs/`, `openspec/`, `*.md`) или другие workflow
- **THEN** ни Pages, ни Worker'ы не выкатываются, изоляты Worker'ов не перезапускаются

#### Scenario: Правка одного Worker'а

- **WHEN** push меняет только `workers/tracks/`
- **THEN** выкатывается только `nakarte-tracks`

#### Scenario: Push в апстрим или чужой форк

- **WHEN** workflow срабатывает не в `sergeycw/trailroutine`
- **THEN** задание пропускается без обращения к Cloudflare
