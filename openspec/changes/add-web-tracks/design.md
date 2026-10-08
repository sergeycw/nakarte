# Design

## Context

Зачем — [proposal](proposal.md). Что переносится — [ресёрч, п. 5](../../research/new-ui.md#5-инвентаризация-функций) и [п. 6](../../research/new-ui.md#6-контракты-которые-новый-ui-держит); контракт хранилища — спека [track-storage](../../specs/track-storage/spec.md) и [аудит, п. 2](../../research/system-design-audit.md#2-контракты); решения владельца — архивы [record-ui-decisions](../archive/2026-10-08-record-ui-decisions/design.md) и [record-new-ui-decisions](../archive/2026-10-08-record-new-ui-decisions/design.md); адрес, стор и тестовая сеть — [add-web-map-layers](../archive/2026-10-08-add-web-map-layers/design.md).

Справочник старого клиента — [src/lib/leaflet.control.track-list/](../../../src/lib/leaflet.control.track-list/): парсеры [lib/parsers/](../../../src/lib/leaflet.control.track-list/lib/parsers/), сервисы импорта [lib/services/](../../../src/lib/leaflet.control.track-list/lib/services/), экспорт [geo_file_exporters.js](../../../src/lib/leaflet.control.track-list/lib/geo_file_exporters.js), деление у меридиана 180° [meridian180.js](../../../src/lib/leaflet.control.track-list/lib/meridian180.js), список и ссылки [track-list.js](../../../src/lib/leaflet.control.track-list/track-list.js), параметры адреса [track-list.hash-state.js](../../../src/lib/leaflet.control.track-list/track-list.hash-state.js) и [App.js](../../../src/App.js) (`bindHashStateReadOnly`: параметр трека читается и стирается из адреса, без годного `m=` карта показывает треки целиком).

Что выяснилось при чтении старого кода (2026-10-08, `master` `f1663a2`):

- Файлы читаются как «двоичная строка» (`readAsBinaryString`), а названия потом раскодируются из UTF-8 (`utf8.decode`). GPX или KML в Windows-1251 с честным `encoding=` дают испорченные названия; имена файлов в ZIP всегда раскодируются как CP866, даже с флагом UTF-8 (бит 11).
- Парсер GeoJSON стоит последним и на любой нераспознанный файл отвечает `CORRUPT`, а не `UNSUPPORTED`: «испорчен» вместо «формат не поддерживается».
- Экспорт пишет UTF-8 через двоичную строку (`utf8.encode`, потом `blobFromString` кладёт каждый символ байтом) — в новом коде это просто строка в `Blob`. KML закрывается строкой `\t</kml>`; имя ZIP берёт месяц из `getMonth()` (январь — `00`).
- Ссылка `nktl=` копируется до ответа хранилища, ошибка записи приходит уведомлением, когда ссылка уже у пользователя ([track-storage.md](../../../docs/architecture/track-storage.md)).
- Фикстуры [test/track_load_data](../../../test/track_load_data/): `files/` — GPX-прототипы, которые автор загружал в сервисы; `testcases/` — ссылки на сервисы и ожидаемый результат разбора. Самих ответов сервисов нет: karma ходит в живые сервисы. Файлов KML, KMZ, GeoJSON, Ozi и ZIP нет.
- MapLibre 6.13 без `glyphs` в стиле рисует подписи символьного слоя локально (TinySDF, шрифт из `text-font` как CSS-семейство): `GlyphManager._getAndCacheGlyphsPromise` в `maplibre-gl` идёт в `_drawGlyph`, когда `url` не задан. Файлов шрифтов для подписей точек не нужно. `diff` стиля для GeoJSON-источника с новыми данными делает `setGeoJSONSourceData`, без пересоздания источника.

Версии зависимостей на 2026-10-08 (`npm view`): `fflate` 0.8.3 (MIT), `pbf` 5.1.2 (BSD-3-Clause), `blueimp-md5` (тот же, что у Worker'а [workers/tracks](../../../workers/tracks/src/key.js)), `@xmldom/xmldom` 0.9.12 (MIT, только для тестов в Node). `fflate.unzipSync` раскодирует имя файла как Latin-1, если у записи нет флага UTF-8 (`strFromU8(…, !(flags & 2048))` в `esm/browser.js`), и бросает на неизвестном методе сжатия.

## Goals / Non-Goals

**Goals:**
- Модель трека и модули (парсеры, экспорт, `nktk`, ссылки), на которые редактор маршрута (change 5), автосохранение (change 6) и профиль высот (change 7) опираются без переделки.
- Паритет со старым клиентом на его форматах и ссылках, проверенный тестами на фикстурах, а не глазами.

**Non-Goals:**
- Правка линии, точек и рисование (change 5): «New track» создаёт пустой трек, рисовать его начнёт редактор.
- Отметки расстояния на линии (галочка длины старого клиента) — вместе с линейкой в change 8; флаг `measureTicksShown` читается из ссылок и пишется в них уже сейчас.
- GPX с высотами и профиль (change 7), разметка маршрута в ссылках (change 6).
- Подсветка трека при наведении, начало и конец трека цветом, «Show all / Hide all» — полировка (change 11).
- Импорт Strava, Garmin Connect, Wikiloc (решение владельца); старый клиент, Worker'ы и их `ALLOWED_ORIGINS`.

## Decisions

Решения, которых нет в ресёрче, архивах и задаче change, помечены **[агент]**: владелец в эту сессию недоступен (попросил не беспокоить и вести changes дальше самому), они приняты агентом и ждут его подтверждения при просмотре. Замечания владельца по интерфейсу, если появятся, записываются сюда как **[владелец]**.

### Модель трека

`web/src/tracks/model.ts`: `LatLng {lat, lng}`, `Waypoint {lat, lng, name}`, `TrackData {name, segments: LatLng[][], points: Waypoint[], color?, hidden?, measureTicksShown?}` — результат любого парсера и ссылки; `GeoData = TrackData & {error?}` — с кодом ошибки (`CORRUPT`, `UNSUPPORTED`, `NETWORK`, `INVALID_URL` или готовый текст, как в старом клиенте). `Track` в сторе — `TrackData` + `id`, `color` (индекс 0–5), `visible`. Длина — сумма отрезков по сфере с R = 6 371 000 м (как `L.CRS.Earth.R` в Leaflet 1.0.3, `distanceTo`), кешируется по ссылке на массив отрезков.

При добавлении в список отрезок, пересекающий 180° (скачок долготы больше 180°), разворачивается в непрерывную долготу, затем упрощается с допуском `360 / 2^24` градуса (≈ 2.4 м, `simplifyLatlngs` старого клиента: отсев по радиусу + Дуглас — Пекер Leaflet 1.0.3 в градусах), отрезок из одной точки дублируется. Это и экономия памяти на больших GPX, и сетка `nktk`, на которой ссылки и так округляются.

### Парсеры — чистые функции от байтов

`parseGeoFile(name, bytes: Uint8Array): GeoData[]` перебирает парсеры в порядке старого клиента (KMZ, ZIP, GPX, Ozi `rte`, `plt`, `wpt`, KML, GeoJSON); каждый возвращает `null`, если формат не его. Отличия от старого клиента — исправления, а не новое поведение:

- Текст XML раскодируется `TextDecoder` по `encoding=` из объявления (`windows-1251`, `koi8-r` и др., неизвестное — UTF-8), Ozi — UTF-8 без BOM для `plt`/`rte` и Windows-1251 для названий точек `wpt` (как `decodeCP1251` старого клиента), имена файлов ZIP — `ibm866`, если нет флага UTF-8.
- GeoJSON — `null` (формат не распознан), если это не JSON с массивом `features`; понимает `LineString`, `MultiLineString` и `Point` (у старого — без `MultiLineString`) **[агент]**: `MultiLineString` даёт экспорт многих сервисов, а цена — три строки.
- ZIP и KMZ — `fflate.unzipSync`; ZIP пропускает внутри `pdf`, `doc`, `txt`, `jpg` и каталоги, как старый.

XML разбирает `DOMParser` браузера (`text/xml`); ошибка разбора (`parsererror` в документе или исключение) — `null`. В unit-тестах Node `DOMParser` — `@xmldom/xmldom`, подключённый `setupFiles` проекта `unit`; те же фикстуры гоняет browser-тест в Chromium, чтобы расхождение `xmldom` и браузера не прошло незамеченным.

### `nktk` и ссылки старого клиента

- `web/src/tracks/nktk.ts`: разбор версий 0 (`track://`), 1–3 (упакованные числа) и 4 (protobuf, `pbf`; схема — [nktk.proto](../../../src/lib/leaflet.control.track-list/lib/parsers/nktk.proto), чтение и запись написаны руками, сгенерированный `nktk_pb.js` не переносится), запись — только версия 4, как старый `saveNktk`. Base64url с `=` и без, байты вместо двоичной строки.
- `web/src/tracks/links.ts`: `nktk`, `nktl` (`GET {tracksStorageServer}/track/{key}`), `nktu` (`decodeURIComponent` → импорт по ссылке), `nktp` (точка), `nktj` (JSON с `n`, `t`, `p`, `u`, `c`, `v`, `m`, как `loadTracksFromJson`). Параметры читаются при старте и на `hashchange`; после чтения параметр стирается из адреса (`replaceState`), остальные — на местах. Без годного `m=` в адресе карта после загрузки показывает все загруженные треки (`fitBounds`).
- Запросы к хранилищу — без `credentials` **[агент]**: Worker отражает `Origin` и так ([track-storage](../../specs/track-storage/spec.md), «CORS только для клона»), а cookies ему не нужны; аудит, п. 2, называет `withCredentials` наследием старого клиента. Контракт Worker'а не меняется.

### Ссылка — после ответа хранилища

«Copy link»: строки `nktk` версии 4 видимых или всех треков через `/` (линии упрощаются тем же допуском, видимость пишется как есть, «Copy link for track» пишет трек видимым, как `trackToString(track, forceVisible)`) → `key = base64url(md5(тело))` без `=` → `POST /track/{key}` → только после `200` адрес `#…&nktl={key}` без `q`, `r` и параметров треков уходит в буфер обмена. Буфер — `navigator.clipboard.write([new ClipboardItem({'text/plain': промис})])`: промис ссылки отдаётся в обработчике клика, поэтому Safari не теряет жест пользователя за время запроса, а Chromium ждёт промис. Не получилось (нет разрешения, старый браузер) — окно с полем ссылки и кнопкой «Copy» **[агент]**. Успех — тост `Link copied`. Ошибка — тост `Error making link: …` (`413` → `track is too big`), ссылку пользователь не получает.

### Импорт по ссылке

`web/src/tracks/import-url.ts`: сервисы — в порядке старого клиента без Strava, Garmin и Wikiloc: линейка Яндекс Карт (без сети), `track://`, ссылка nakarte (параметры треков из `#`), OSM (`/trace/{id}/data`), Sports Tracker (два запроса, `403`/`404` — причины), Tracedetrail (страница, `geometry` в EPSG:3857 → широта и долгота формулой обратной сферической Меркатора с R = 6 378 137 м, как `L.CRS.EPSG3857.unproject`), любой `http(s)` — файл через прокси, название — последний сегмент пути ответа. Запросы — `fetch` в адрес `urlViaCorsProxy` (`<прокси>https/host/path`, как в каталоге слоёв). Ссылка Strava, Garmin или Wikiloc попадает в «любой файл»: страница — HTML, сообщение `unsupported format`. Ошибка сети — `NETWORK`.

`fetch` приходит параметром (по умолчанию глобальный): unit-тесты сервисов подставляют ответы-фикстуры, browser-тесты — заглушку через проп `App`.

### Экспорт

`web/src/tracks/export.ts`: `toGpx`, `toKml` — строки UTF-8 с экранированием XML (`&`, `<`, `>`, `"`, `'`), шесть знаков координат, GPX 1.1 с фиктивным `<time>` у точек трека (совместимость с Garmin Connect, как в старом), KML 2.2 с `</kml>` в конце; `toZip` — `fflate.zipSync` из GPX каждого трека, имена: точка в начале → `_`, расширения трека убираются (`splitExtensions` старого клиента), недопустимые символы → `_`, повторы — `name(1)`; архив `nakarte_tracks_ДД.ММ.ГГГГ_ЧЧ.ММ.zip` с правильным месяцем. Отрезки делятся у меридиана 180° (`splitLinesAt180Meridian`). Сохранение — `Blob` + `<a download>`.

### Треки на карте

Треки — два GeoJSON-источника в том же стиле, что слои (`buildStyle`), над всеми слоями: `tracks` (линии, `line-width` 6, `line-opacity` 0.5, `line-cap: round`, цвет из свойства — `TrackSegment` старого клиента) и `track-points` (кружки цвета трека с белой обводкой и подписи справа, `text-font: ['sans-serif']`, белый ореол). Подписи рисуются локально, без `glyphs` (Context). Один источник на все треки: смена цвета или видимости — новые данные одного источника через `setGeoJSONSourceData`. Скрытые треки в данные не попадают. Вид «показать трек» — запрос `fitBounds` в сторе, как `viewRequest` из адреса.

### Список треков **[агент]**

- Карточка shadcn слева, под панелью с названием, ширина 20 rem и не шире окна без полей, сворачивается кнопкой в заголовке; список прокручивается внутри, когда треков много. Справа сверху остаются слои, справа снизу — атрибуция.
- Строка ввода: «New track», «Open file» (`<input type="file" multiple>`), поле ссылки с кнопкой загрузки (Enter тоже), меню списка (shadcn `DropdownMenu`): «Copy link for all tracks», «Copy link for visible tracks», «Create new track from all visible tracks», «Save all tracks to ZIP file», разделитель, «Delete all tracks», «Delete hidden tracks». Тексты — старого клиента.
- Строка трека: флажок видимости (Shift+клик — показать только этот, как старый), цвет (поповер с шестью цветами), название (клик — показать трек), длина, меню трека: «Rename» (окно с полем), «Duplicate», «Reverse», «Delete», «Save as GPX», «Save as KML», «Copy link for track».
- Пока файлы и ссылки грузятся — индикатор в заголовке вместо иконки, поле ссылки недоступно.
- «Delete all» без подтверждения, как в старом клиенте. Перетаскивание файлов — на всю карту.

### Стор

Треки — в том же сторе Zustand (`web/src/state/store.ts`): `tracks`, `addTracks(geodata[])`, `updateTrack`, `removeTracks`, `boundsRequest`. Чтение параметров треков из адреса и их стирание — в `sync.ts` рядом с `m=` и `l=`; загрузка асинхронная и сама вызывает `addTracks`. Цвет нового трека без цвета из ссылки — следующий по кругу (`_lastTrackColor`).

### Тесты

- **Unit (Node)**: каждый парсер на фикстурах `web/src/tracks/fixtures/` — GPX-прототипы из `test/track_load_data/files/` и новые файлы KML (с `gx:Track` и точками), KMZ, GeoJSON (`LineString`, `MultiLineString`, `Point`), PLT, RTE, WPT (Windows-1251), ZIP (вложенные форматы, имя в CP866), GPX в Windows-1251, испорченные варианты. Ожидания для форматов старого клиента — результат его же парсеров на тех же файлах (собран разово скриптом вне репозитория, лежит рядом JSON), чтобы паритет проверялся, а не предполагался. `nktk`: версии 1–4 (`nktk` и `nktj` из `old-links.txt` и строки, записанные старым `saveNktk`), запись → чтение. Сервисы импорта: записанные 2026-10-08 ответы OSM, Sports Tracker, Tracedetrail на ссылки из `test/track_load_data/testcases/` против ожидаемого там `geodata`. Экспорт: GPX/KML → парсер → тот же трек; ZIP — имена. Длина, упрощение, 180°.
- **Browser mode**: те же фикстуры парсеров в Chromium (`DOMParser` браузера); список треков в `App`: открыть файл, видимость, цвет, переименовать, дублировать, развернуть, удалить, удалить скрытые, новый из видимых; слои треков на карте над слоями; «Copy link» — запрос записи до ссылки, `413`, ошибка сети. Хранилище и прокси — заглушка `fetch` через проп `App`.
- **e2e**: `fixtures.ts` получает хранилище в памяти (`POST`/`GET /track/{key}` на адрес `tracksStorageServer` с CORS-заголовками) и ответы прокси по шаблонам адресов из фикстур. Сценарии спек с теми же названиями: ссылка `nktl=` из `old-links.txt` (тело — из фикстуры), ссылки `nktk=` и `nktp=`, «Copy link» → открыть ссылку в новой вкладке, импорт OSM через прокси, открыть файл (`setInputFiles`), экспорт GPX (`download`), неизвестный ключ `404`.
- Живые хранилище и прокси — на проде после деплоя: `ALLOWED_ORIGINS` не включают 8769 и 4173.

### Память при большом треке

Сценарий из задачи change: импорт большого GPX (≈ 100 тыс. точек, шум больше допуска упрощения, чтобы упрощение не спасало). Замер `phys_footprint` по дереву процессов Chromium (`launchServer`, `footprint --pid`), эмуляция Pixel 7, `vite preview`, как в архивах [spike-engine-in-worker](../archive/2026-10-08-spike-engine-in-worker/design.md#память-вкладки) и [add-web-map-layers](../archive/2026-10-08-add-web-map-layers/design.md#память-при-нескольких-слоях): только карта против карты с треком, после загрузки и после прокруток. Итог — раздел «Проверки».

## Risks / Trade-offs

- [Разбор XML в Node (`xmldom`) и в браузере расходится на краях] → browser-тест на тех же фикстурах.
- [Ссылка после ответа: в браузерах без `ClipboardItem` с промисом буфер не сработает] → окно со ссылкой; Chromium и Safari поддерживают.
- [Большой GPX — один GeoJSON-источник на все треки: смена цвета одного трека перекладывает все] → упрощение при импорте режет точки; замер памяти и времени покажет, нужен ли источник на трек.
- [Сервисы импорта меняют вёрстку и API (Tracedetrail — разбор HTML)] → фикстуры ловят регрессии кода, но не сервиса; живьём — на проде после деплоя, отказ сервиса — сообщение `unsupported format`.
- [Решения **[агент]** без подтверждения владельца] → вынесены отдельно, правка — мелкий change.

## Migration Plan

1. PR в `master`, `check web` зелёный.
2. Merge → `deploy pages` выкатывает `/next/` с треками.
3. На проде: ссылки `nktl=` клона (свои ключи хранилища), «Copy link» → открыть ссылку, импорт OSM, Sports Tracker, Tracedetrail и файла по URL через прокси. Итог — в этот design, архив — вторым PR.
4. Откат — revert и push.
