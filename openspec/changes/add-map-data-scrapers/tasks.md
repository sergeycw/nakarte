# Tasks

## 1. Источники

- [ ] 1.1 Найти способ получить данные westra.ru и geocaching.su (официальный экспорт, API, массовая выгрузка), прочитать условия использования и `robots.txt`; проверка: выбранный путь и ссылки на условия записаны в `design.md`, а если сбор запрещён — change остановлен и вопрос передан владельцу
- [ ] 1.2 Снять схемы файлов автора (`westra_passes2.json`, `westra_coverage.json`, `westra_regions_labels1.json`, `westra_regions_labels2.json`, `geocaching_su2.json`) и сохранить фикстурами вместе с образцами ответов источников; проверка: фикстуры лежат в `workers/scrapers/test/fixtures/`

## 2. Каркас сервиса

- [ ] 2.1 Создать `workers/scrapers/` с `wrangler.toml` (cron раз в сутки, привязка R2) и `package.json` с тестами в рантайме Workers; проверка: `npx vitest run` проходит на пустом тесте
- [ ] 2.2 Workflow `.github/workflows/check-scrapers.yml` с `paths: ['workers/scrapers/**', '.github/workflows/check-scrapers.yml']`; проверка: workflow зелёный на PR

## 3. Перевалы

- [ ] 3.1 Разбор данных westra.ru в схему `westra_passes2.json` и GeoJSON покрытия и подписей; проверка: тест на сохранённых ответах источника выдаёт файлы, проходящие проверку схемы
- [ ] 3.2 Бережность: `robots.txt`, свой `User-Agent`, паузы; проверка: тест с заглушкой источника убеждается, что запрещённые пути не запрашиваются и паузы соблюдаются

## 4. Геокешинг

- [ ] 4.1 Разбор данных geocaching.su в массив `[name, id, lat, lng]`; проверка: тест на сохранённых ответах выдаёт файл, проходящий проверку схемы
- [ ] 4.2 Бережность для geocaching.su; проверка: тест как в 3.2

## 5. Сборка и раздача

- [ ] 5.1 Обработчик `scheduled`: сбор, проверка схемы и непустоты, запись в R2 только при успехе; проверка: тест — при сбое источника файлы в R2 не меняются
- [ ] 5.2 Обработчик `fetch`: `/westraPasses/<файл>`, `/geocachingSu/<файл>`, `Access-Control-Allow-Origin: *`, сжатие, `Cache-Control: max-age` ≥ 3600, `404` на неизвестный файл; проверка: тесты заголовков и путей

## 6. Деплой и клон

- [ ] 6.1 Деплой Worker и шаг в `.github/workflows/deploy-pages.yml`, первый ручной запуск сборки; проверка: файлы появились в R2 и отдаются по `curl`
- [ ] 6.2 `westraDataBaseUrl` и `geocachingSuUrl` в `src/config-target/clone.js`; проверка: в браузере на локальном клоне оба слоя отображаются с данными клона
- [ ] 6.3 Обновить `AGENTS.md` (источники, расписание, ручной запуск) и статус в `openspec/research/own-backends.md`; проверка: команды из `AGENTS.md` выполняются как написано

## 7. Прод

- [ ] 7.1 На `https://nakarte-routing.pages.dev` включить оба слоя; проверка: маркеры видны, запросов к `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/` нет

## Workflow follow-up

- Архивировать: `openspec archive add-map-data-scrapers --yes`.
