# track-files Specification

## Purpose
Импорт треков нового приложения из файлов (GPX, KML, KMZ, GeoJSON, Ozi, ZIP) и по ссылкам на внешние сервисы через CORS-прокси клона, экспорт треков в файлы.

## Requirements

### Requirement: Импорт файлов треков

Новое приложение SHALL открывать файлы треков кнопкой выбора файлов (несколько сразу) и перетаскиванием на карту. Формат SHALL определяться по содержимому, а не по расширению. Название трека — имя файла; для трека OSM — название из файла.

#### Scenario: Открыть GPX

- **WHEN** пользователь открывает GPX с двумя сегментами трека и двумя точками
- **THEN** в списке появляется трек с названием файла, двумя отрезками и двумя точками с их названиями

#### Scenario: Файл перетащили на карту

- **WHEN** пользователь перетаскивает файл KML на карту
- **THEN** трек из файла появляется в списке

### Requirement: Форматы файлов треков

Импорт SHALL понимать: GPX (треки, маршруты `rte`, точки `wpt`), KML (`LineString`, `gx:Track`, точки `Placemark`), KMZ (все `.kml` архива с `doc.kml`), GeoJSON (`LineString`, `MultiLineString`, `Point`), Ozi Explorer (`plt` — трек, `rte` — маршрут, `wpt` — точки), ZIP с файлами любых из этих форматов.

#### Scenario: Архив с несколькими файлами

- **WHEN** пользователь открывает ZIP с GPX и PLT внутри
- **THEN** в списке появляется по треку на каждый файл архива

### Requirement: Кодировки файлов треков

Текст GPX и KML SHALL читаться в кодировке из объявления XML (по умолчанию UTF-8), названия точек Ozi `wpt` — в Windows-1251, имена файлов в ZIP — в CP866, если архив не помечает их как UTF-8.

#### Scenario: Кириллица в Windows-1251

- **WHEN** пользователь открывает GPX с `encoding="windows-1251"` или Ozi `wpt` с кириллицей в названиях точек
- **THEN** названия читаются без искажений

### Requirement: Сообщение об ошибке источника

Если файл или ссылку не удалось прочитать полностью, новое приложение SHALL открывать то, что прочиталось, и показывать сообщение старого клиента: `File "{name}" is corrupt`, `File "{name}" has unsupported format or is badly corrupt`, `Could not download file from url "{name}"` или `"{name}" is not of supported URL type`. К тексту SHALL добавляться `, no data could be loaded`, если данных нет, иначе `, loaded data can be invalid or incomplete`.

#### Scenario: Неизвестный формат

- **WHEN** пользователь открывает файл, который не является ни одним из форматов
- **THEN** показано `File "{name}" has unsupported format or is badly corrupt, no data could be loaded`, трек не добавлен

#### Scenario: Испорченный трек

- **WHEN** в GPX у части точек нет координат
- **THEN** точки до испорченной открываются, показано сообщение `… is corrupt, loaded data can be invalid or incomplete`

### Requirement: Источник без данных

Файл или ссылка без отрезков и точек и без ошибки SHALL давать сообщение `No data could be loaded from file "{name}". File is empty or contains only unsupported data.` и SHALL NOT добавлять трек.

#### Scenario: Пустой GPX

- **WHEN** пользователь открывает GPX без треков и точек
- **THEN** показано сообщение о пустом файле, список не меняется

### Requirement: Импорт по ссылке

Новое приложение SHALL открывать треки по ссылке, вставленной в строку поиска (спека `map-search`, «Ссылки на треки в поиске»); отдельного поля ссылки в списке треков нет. Запросы к внешним сайтам SHALL идти через CORS-прокси клона. Приватный, удалённый или несуществующий трек сервиса SHALL давать сообщение с причиной, если сервис её сообщает. Импорт Strava, Garmin Connect и Wikiloc SHALL NOT поддерживаться.

#### Scenario: Приватная тренировка Sports Tracker

- **WHEN** Sports Tracker отвечает `403` на данные тренировки
- **THEN** показано `Sports Tracker user disabled viewing this activity`, трек не добавлен

#### Scenario: Файл по ссылке

- **WHEN** пользователь вставляет в строку поиска прямую ссылку на GPX и выбирает результат
- **THEN** файл скачивается через прокси клона и открывается, название трека — имя файла из ссылки

### Requirement: Источники ссылок

Импорт по ссылке SHALL понимать: линейку Яндекс Карт (параметр `rl=`, без запросов в сеть), трек OSM (`openstreetmap.org/user/…/traces/{id}`), тренировку Sports Tracker (`sports-tracker.com/workout/…/{id}`), трек Tracedetrail (`tracedetrail.*/…/trace/{id}`, `…/iframe/{id}`), ссылку nakarte с параметрами треков (`nktk`, `nktl`, `nktu`, `nktp`, `nktj`) и `track://`, любой файл трека по `http(s)` (формат по содержимому).

#### Scenario: Трек OSM

- **WHEN** пользователь вставляет ссылку на публичный трек OSM
- **THEN** трек скачивается через прокси клона и открывается с названием из файла

#### Scenario: Линейка Яндекса

- **WHEN** пользователь вставляет ссылку Яндекс Карт с `rl=`
- **THEN** открывается трек `Yandex ruler` без запросов в сеть

### Requirement: Экспорт треков

Трек SHALL сохраняться в GPX 1.1 (отрезки — `trkseg`, точки — `wpt`) и в KML 2.2 (отрезки — `LineString`, точки — `Point`) в UTF-8, координаты с шестью знаками; все треки — в ZIP с GPX каждого трека, имена файлов уникальны. Отрезок, пересекающий меридиан 180°, SHALL делиться на два у меридиана. Пустой трек SHALL давать `Track is empty, nothing to save` вместо файла.

#### Scenario: Сохранить в GPX

- **WHEN** пользователь сохраняет трек с отрезками и точками в GPX и открывает файл снова
- **THEN** открывается трек с теми же отрезками и точками (координаты до шести знаков)

#### Scenario: Все треки в ZIP

- **WHEN** пользователь сохраняет в ZIP два трека с одинаковым названием
- **THEN** в архиве два GPX с разными именами

### Requirement: GPX с высотами

«Save as GPX with elevation» SHALL сохранять трек в GPX, как экспорт треков, и добавлять каждой точке отрезков и каждой точке трека `<ele>` — высоту из API высот с одним знаком после точки; точка, на которую API ответил `NULL`, остаётся без `<ele>`. Ошибка сети или ответ не `200` SHALL давать сообщение `Failed to get elevation data: <причина>` без файла. Пустой трек SHALL давать `Track is empty, nothing to save` без запросов.

#### Scenario: Сохранить с высотами

- **WHEN** пользователь сохраняет трек с отрезком из трёх точек и одной точкой трека в GPX с высотами
- **THEN** в файле у трёх `trkpt` и у `wpt` есть `<ele>` с высотами, которые вернул API, координаты — как в обычном GPX

#### Scenario: Точка без данных

- **WHEN** API ответил `NULL` на одну точку отрезка
- **THEN** у этой `trkpt` нет `<ele>`, у остальных есть

#### Scenario: Сервис недоступен

- **WHEN** запрос высот упал ошибкой сети
- **THEN** появляется сообщение `Failed to get elevation data: network error`, файл не сохраняется

### Requirement: Файл для устройства

Пункт «Send to device» меню трека SHALL открывать окно «Send to device» и собирать в нём GPX с высотами, как «Save as GPX with elevation»; пока файл собирается, кнопки окна SHALL быть неактивны. Ошибка API высот SHALL давать обычный GPX без `<ele>` и в окне строку `Elevation data unavailable: <причина>. The file has no elevation.` Пустой трек SHALL давать `Track is empty, nothing to save` без окна и запросов.

#### Scenario: Файл для устройства

- **WHEN** пользователь выбирает «Send to device» у трека с отрезком из трёх точек
- **THEN** открывается окно «Send to device», после ответа API высот кнопка «Download» активна и сохраняет GPX, где у трёх `trkpt` есть `<ele>`

#### Scenario: Высоты недоступны

- **WHEN** запрос высот для «Send to device» упал ошибкой сети
- **THEN** в окне строка `Elevation data unavailable: network error. The file has no elevation.`, «Download» сохраняет GPX без `<ele>`

#### Scenario: Пустой трек на устройство

- **WHEN** пользователь выбирает «Send to device» у трека без отрезков и точек
- **THEN** появляется сообщение `Track is empty, nothing to save`, окна нет, запросов к API высот нет

### Requirement: Шторка «Поделиться» с откатом на скачивание

Если браузер умеет делиться файлами (Web Share), в окне «Send to device» SHALL быть кнопка «Share»: она SHALL открывать системную шторку с файлом окна (имя — как у «Save as GPX», тип `application/gpx+xml`) и после успеха закрывать окно. Закрытая пользователем шторка SHALL NOT менять ничего; любой другой отказ браузера SHALL скачивать тот же файл. Кнопка «Download» SHALL быть всегда.

#### Scenario: Отправить через шторку

- **WHEN** пользователь нажимает «Share» в окне «Send to device» трека «Kazbek»
- **THEN** шторка получает файл `Kazbek.gpx` типа `application/gpx+xml`, окно закрывается

#### Scenario: Браузер не отдаёт файл

- **WHEN** браузер отклоняет шторку с `NotAllowedError` (Chrome на `.gpx`)
- **THEN** скачивается тот же `Kazbek.gpx`, окно остаётся открытым

#### Scenario: Шторку закрыли

- **WHEN** пользователь закрыл шторку, не выбрав приложение (`AbortError`)
- **THEN** ничего не скачивается, окно остаётся открытым

#### Scenario: Нет Web Share

- **WHEN** браузер не умеет делиться файлами
- **THEN** в окне только кнопка «Download»

### Requirement: Инструкция для приложений устройств

Окно «Send to device» SHALL показывать короткую инструкцию, как довести файл до устройства, для Garmin Connect, Wahoo и COROS, у каждого — ссылку на статью справки производителя, открывающуюся в новой вкладке.

#### Scenario: Инструкция для приложений

- **WHEN** открыто окно «Send to device»
- **THEN** в нём блоки Garmin Connect, Wahoo и COROS со ссылками на `support.garmin.com`, `support.wahoofitness.com` и `support.coros.com`
