# Фикстуры треков

Тесты треков в сеть не ходят: всё, что они читают, лежит здесь. Импорт в тестах — `?raw` для текста и `?bytes` для двоичных файлов (плагин `fixtureBytes` в `vitest.config.ts`).

## `files/` — файлы для парсеров

- `osm_prototype_*.gpx`, `track_service_prototype_*.gpx` — копия `test/track_load_data/files/` старого клиента: GPX, которые автор загружал в сервисы (Garmin GPSMAP 78s, кириллица в названиях точек).
- Остальные созданы 2026-10-08 скриптом вне репозитория под форматы старых парсеров (`src/lib/leaflet.control.track-list/lib/parsers/`): `route.gpx` (трек и `rte`), `cp1251.gpx` (`encoding="windows-1251"`), `corrupt.gpx` (точка без `lat`), `empty.gpx`, `lines.kml` (`LineString`, `Point`, `gx:Track`, `&amp;` в названии), `track.kmz` (`doc.kml` + `files/extra.kml` + картинка), `features.geojson` (`Point`, `LineString`, `Polygon`), `multi.geojson` (`MultiLineString`), `track.plt`, `corrupt.plt` (в заголовке 5 точек, в файле 4), `route.rte` (два маршрута), `points.wpt` (названия в Windows-1251), `archive.zip` (`трек.gpx` с именем в CP866 без флага UTF-8, `track.plt` без сжатия, `юникод.gpx` с флагом UTF-8, `readme.txt`, каталог `folder/`), `unknown.txt`.

## `old-parsers.json` — результат старых парсеров

`parseGeoFile` старого клиента на файлах из `files/`, где его поведение и есть требование (прототипы GPX, `route.gpx`, Ozi, `features.geojson`, испорченные и пустой файл). Собран 2026-10-08: rolldown-бандл `parseGeoFile` с алиасом `~` → `src/`, `DOMParser` из `@xmldom/xmldom`, файл — двоичной строкой, как `readAsBinaryString`. Вендорный `js-unzip` подключён так же, как его отдаёт webpack (default-импорт — объект модуля), поэтому `parseKmz` старого клиента всегда возвращает `null` и KMZ открывается веткой ZIP по треку на файл — в новом приложении это исправлено, ожидания для KMZ и других исправлений (Windows-1251, нераспознанный формат, `MultiLineString`, KML с не-ASCII) записаны в тестах явно. Не-ASCII в KML через xmldom для эталона не годится: байт `0x85` из UTF-8 буквы `х` xmldom превращает в перевод строки, браузер — нет.

## `services/` — ответы сервисов импорта

Записаны `curl` 2026-10-08 на ссылки из `test/track_load_data/testcases/` (копия ожиданий — `services/expected/`): `osm-{id}.gpx` — `openstreetmap.org/trace/{id}/data` после редиректа (у `3376095`, `3376097`, `33761000` — `404`), `sportstracker-{id}-{data,combined}.json` — `api.sports-tracker.com/apiserver/v1/workouts/{id}/…`, `tracedetrail-*.html` — страница трека, урезанная до строк, которые читает импорт (`<title>`, `geometry:`, тексты удалённого и приватного трека).
