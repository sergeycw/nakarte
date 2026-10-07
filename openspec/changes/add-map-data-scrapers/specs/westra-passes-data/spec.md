# Spec Delta

## Purpose

Данные каталога перевалов Вестры (westra.ru) для слоя перевалов клона: собираются у источника по расписанию и раздаются в той же схеме, что ждёт клиент nakarte.

## ADDED Requirements

### Requirement: Файлы слоя перевалов

По адресу `<база>/westra_passes2.json`, `<база>/westra_coverage.json`, `<база>/westra_regions_labels1.json` и `<база>/westra_regions_labels2.json` SHALL отдаваться JSON той же схемы, что у файлов автора на 2026-10-07: объект `{passes, regions}` с полями перевала `id`, `name`, `latlon`, `elevation`, `grade_eng`, `regions`, `is_summit`, `comments`, `author`, `reports_*`; GeoJSON покрытия и подписей регионов.

#### Scenario: Слой перевалов в клоне

- **WHEN** пользователь клона включает слой перевалов Вестры
- **THEN** маркеры, покрытие и подписи регионов загружаются с адреса клона и отображаются как у автора

#### Scenario: Схема файла

- **WHEN** собранный `westra_passes2.json` проверяется против схемы, снятой с файла автора
- **THEN** все обязательные поля есть и имеют те же типы

### Requirement: Обновление раз в сутки

Данные SHALL пересобираться не реже раза в сутки. Если сборка упала или дала пустой результат, SHALL оставаться предыдущая версия файлов.

#### Scenario: Сбой источника

- **WHEN** westra.ru недоступен во время сборки
- **THEN** файлы в хранилище не меняются, сбой виден в логах

### Requirement: Бережный скрапинг

Сборщик SHALL соблюдать `robots.txt` westra.ru, представляться своим `User-Agent` со ссылкой на проект и делать паузу между запросами.

#### Scenario: Запрещённый путь

- **WHEN** путь запрещён в `robots.txt`
- **THEN** сборщик его не запрашивает

### Requirement: Раздача с CORS и кешем

Файлы SHALL отдаваться с `Access-Control-Allow-Origin: *`, сжатием и `Cache-Control` с `max-age` не меньше часа.

#### Scenario: Заголовки

- **WHEN** клиент запрашивает `westra_passes2.json`
- **THEN** в ответе есть `Access-Control-Allow-Origin: *` и `Cache-Control` с `max-age` не меньше 3600
