# Spec Delta

## ADDED Requirements

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
