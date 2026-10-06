# Роутинг OSM в браузере без сервера-роутера: альтернативы CheerpJ/TeaVM

Состояние на 2026-10-06. Даты «коммит» — последний коммит в ветке по умолчанию (GitHub/Codeberg API), «релиз» — последний GitHub release/тег/npm.
TeaVM не рассматривается (аудит уже есть). Пометка **[вывод]** — моё заключение, а не факт из источника.

## Сводная таблица

| # | Вариант | Статус / активность | Лицензия | Браузер | Загрузка данных | Пеш./вело, кастомизация | Вердикт для нас |
|---|---|---|---|---|---|---|---|
| 1a | GraalVM Web Image (`--tool:svm-wasm`) | экспериментальный, коммиты в `web-image/` 2026-10-02 | исходники GPLv2 (`web-image/LICENSE`); нужен Oracle GraalVM 25.1+ | Wasm 3.0 (GC, EH, typed refs) | in-memory Jimfs; `RandomAccessFile` только read-only; `Thread.start0` — пустышка | — (компилятор) | теоретически ближе всех к «как есть», но потоков нет, ФС в памяти |
| 1b | J2CL / J2Wasm (Google) | J2CL активен (релиз v20260402, коммит 2026-10-06); J2Wasm «experimental» | Apache-2.0 | JS; Wasm GC (Chrome 119+) | нет `File`, `RandomAccessFile`, `Thread`, рефлексии в JRE-эмуляции | — | нужна серьёзная переделка I/O; Bazel |
| 1c | Bytecoder | релиз 2024-05-10, далее только dependabot (2026-08) | Apache-2.0 | JS, Wasm | OpenJDK 20 classlib; I/O — не подтверждено | — | фактически заморожен |
| 1d | JWebAssembly | коммиты 2026-10-01, релиз v0.4 (2022-03) | Apache-2.0 | Wasm | «file access … will never work»; потоки/рефлексия не сделаны | — | не годится |
| 1e | GWT / JSweet / DoppioJVM | GWT 2.13.1 (2026-06); JSweet коммит 2023-11; Doppio 2021-08 | GWT Apache-2.0*, Doppio MIT | JS | GWT: нет `File`/`RandomAccessFile`/`Thread` | — | GWT как J2CL; остальные мертвы |
| 1f | CheerpX / WebVM (x86-VM в Wasm) | npm `@leaningtech/cheerpx` 1.3.9 (2026-08) | проприетарная (`SEE LICENSE`) ; WebVM Apache-2.0 | Wasm | диск-образ | — | тяжелее CheerpJ, смысла нет |
| 2a | **BeeRouter** (Kotlin Multiplatform форк BRouter) | коммит 2026-06-21; Maven Central `dev.skynomads.beerouter` 0.0.6 (2026-09-28) | MPL-2.0 (производное от BRouter MIT) | таргеты jvm + linuxX64; js/wasm нет | `.rd5` через интерфейс `MapSource`/`RandomAccessReader` | те же `.brf` + `lookups.dat` | самый перспективный путь: добавить таргет `wasmJs`/`js` |
| 2b | stefanhoelzl/tracks `app/brouter` (BRouter → Kotlin через J2K) | коммит 2026-09-23 | MIT | jvm, linuxX64, iOS | `.rd5` через Okio-шимы `java.io` | профили brouter.de, побайтовый паритет с brouter.de | прецедент автоматизированного порта с проверкой паритета |
| 2c | Порт BRouter на Rust/Go/C++/JS/TS | не найден | — | — | — | — | — |
| 3a | route_snapper (Rust→Wasm) | коммит 2026-01-04, npm 0.4.9 (2024-11) | Apache-2.0 | да, wasm-pack | один предсобранный файл графа на область, целиком | только «прилипание» к сети, профилей нет | демо идеи, не роутер профилей |
| 3b | routx | v1.1.0 (2026-06-28) | MIT | wasm не заявлен | OSM XML/PBF целиком в граф | профили CAR/BUS/BICYCLE/FOOT/…, A* | ядро на Rust, но без высот и без языка профилей |
| 3c | fast_paths | 1.0.0 (2024-05) | Apache-2.0 | есть режим 32-бит для wasm | граф целиком, CH-предрасчёт | CH = фиксированные веса | не для профилей на лету |
| 3d | A/B Street (abstreet, 15m, ltn) | abstreet коммит 2025-09; 15m 2026-10-06 | Apache-2.0 | Rust+wasm-pack | граф строится из OSM целиком | городское планирование | источник кода, не роутер |
| 4a | **tobilg/valhalla-wasm** (`valhalla-browser`) | создан 2026-09-17, v0.2.1 (2026-09-21) | MIT (SDK), Valhalla MIT | Web Worker, Wasm 9.86 МБ | `.gph`-тайлы по HTTP Range из индексированного TAR или поштучно | `bicycle`, `pedestrian`, `auto`, `truck` + `costing_options` | рабочий готовый вариант; высот нет |
| 4b | ecc521/valhalla-wasm | v0.1.0 (2026-06-20), коммит 2026-06-23 | MIT | Wasm ~7.4 МБ | TAR из OPFS (ленивое чтение), источник подменяемый | как в Valhalla | альтернатива 4a, офлайн-ориентирована |
| 4c | OSRM в Wasm | не существует; issue #6525 закрыт 2026-04-12 без реализации | BSD-2 | нет | — | — | нет |
| 4d | GraphHopper в браузере | только эксперимент TeaVM 2014 (GH 0.3) | Apache-2.0 | был JS | ~14 МБ JSON на Лондон целиком | — | исторический прецедент, современного нет |
| 4e | Itinero 2 (C#) | коммит 2026-10-02 | Apache-2.0 | Blazor/Wasm — не подтверждено | тайловая сеть, загрузка тайлов по требованию | профили на запрос (C# или Lua), Dijkstra/A* | архитектурно похоже на BRouter, браузер не доказан |
| 4f | pgRouting в PGlite | pgRouting в PGlite нет (есть только экспериментальный PostGIS) | pgRouting GPL-2.0 | — | — | — | нет |
| 4g | routingjs (nilsnolde) | коммит 2024-07 | MIT | да | — | клиент к Valhalla/OSRM/ORS/GH API, **не движок** | не то |
| 5a | geojson-path-finder | 2.1.0 (2025-11) | ISC | JS | GeoJSON целиком | своя `weight`-функция | игрушка/малые области |
| 5b | ngraph.path | 1.6.1 (2025-11) | MIT | JS | граф целиком | A*, NBA*, своя функция веса | алгоритмы готовы, данных нет |
| 5c | Векторные тайлы (OpenMapTiles `transportation`) как граф | готового браузерного роутера не найдено; Atlas (Android) режет OMT-тайлы в `.rd5` | — | — | PMTiles по Range | в OMT есть `bicycle`, `foot`, `mtb_scale`, `surface`, `access`… | реально как источник, но топология и теги урезаны |
| 5d | DuckDB-Wasm + duckpgq | duckpgq собран под wasm_eh (v1.4.1) | MIT | да | httpfs (JS-реализация), Range к Parquet | только невзвешенный `ANY SHORTEST` | не для роутинга |
| 5e | sql.js-httpvfs | коммит 2023-03 | Apache-2.0 | да | SQLite по HTTP Range, read-only | — | годится как хранилище графа, но автор: «не production» |
| 5f | Planner.js (Open Planner Team) | коммит 2023-02 | MIT | да | Linked Routable Tiles по HTTP | транзит + пешком | заброшен |

\* у GWT GitHub API лицензию не распознаёт.

## 1. Компиляторы Java → Wasm/JS

**GraalVM Web Image.** Бэкенд Native Image, включается `--tool:svm-wasm`, на выходе `.js` + `.js.wasm`. Требует Oracle GraalVM 25.1+ и Binaryen 119+, использует Wasm GC, exception handling и typed function references. Статус — «early and experimental». Файловая система — Jimfs в памяти (`FileSystemInitializer`), `RandomAccessFile` подменён только на чтение (`open ... with mode other than readonly` → `UnsupportedOperationException`). `Thread.start0()` — пустой метод, `Unsafe.park` не реализован, то есть потоков нет. Демо: javac и Spring Shell в Wasm. Размер выхода не опубликован.
- https://www.graalvm.org/dev/reference-manual/web-image/
- https://github.com/oracle/graal/tree/master/web-image (README, `docs/get-started.md`, `LICENSE` = GPLv2)
- https://github.com/oracle/graal/blob/master/web-image/src/com.oracle.svm.webimage/src/com/oracle/svm/webimage/substitute/system/WebImageIOSubstitutions.java
- https://github.com/oracle/graal/blob/master/web-image/src/com.oracle.svm.webimage/src/com/oracle/svm/webimage/substitute/system/WebImageJavaLangSubstitutions.java

**J2CL / J2Wasm.** Транспилятор исходников, сборка через Bazel. Wasm-бэкенд «experimental», основан на Wasm GC (Chrome 119+). Рефлексии нет вообще. В `jre/java/java/io` нет `File`, `RandomAccessFile`, `DataInputStream`, в `java/lang` нет `Thread`. На JS-бэкенде `float` считается с точностью `double`. Для BRouter это риск: в порте tracks расхождение `float += double` дало «один джоуль» разницы, см. 2b.
- https://github.com/google/j2cl , https://github.com/google/j2cl/blob/master/docs/limitations.md , https://github.com/google/j2cl/blob/master/docs/getting-started-j2wasm.md

**Bytecoder.** Байткод → JS/Wasm/OpenCL, classlib OpenJDK 20, Java 8–20. Рефлексия частичная: `Class.forName`, конструкторы без аргументов, поля, конфиг `bytecoder-reflection.json`. Последний релиз 2024-05-10, после него только dependabot.
- https://github.com/mirkosertic/Bytecoder , https://mirkosertic.github.io/Bytecoder/chapter-1/page-1-d/

**JWebAssembly.** Автор продолжает коммитить (2026-10-01), последний релиз v0.4 вышел в 2022. Из README: «file access or sockets will never work». Потоки и рефлексия не реализованы, GC через JS-полифилл.
- https://github.com/i-net-software/JWebAssembly

**GWT / JSweet / DoppioJVM.** У GWT 2.13.1 (2026-06-19) эмуляция `java.io` без `File` и `RandomAccessFile`, `Thread` нет. JSweet: последний коммит 2023-11, релиз 2021. DoppioJVM (полноценная JVM на JS): последний коммит 2021-08, релиз 2016.
- https://github.com/gwtproject/gwt/tree/main/user/super/com/google/gwt/emul/java/io , https://github.com/cincheo/jsweet , https://github.com/plasma-umass/doppio

**Сборка самого OpenJDK HotSpot под Emscripten.** В OpenJDK это не поддерживается, в рассылке это назвали «almost a PhD-level research project». Прямые альтернативы CheerpJ — только CheerpX/WebVM, то есть x86-эмуляция, а это ещё тяжелее.
- https://mail.openjdk.org/pipermail/jdk-dev/2024-August/009324.html , https://github.com/leaningtech/webvm

**Kotlin/Wasm** (если идти через порты 2a/2b). Сейчас Beta, нужен браузер с Wasm GC и legacy exception handling. https://kotlinlang.org/docs/wasm-overview.html

Итог по п.1. Модель «синхронный `RandomAccessFile` + потоки», на которой написан BRouter, не поддерживает ни один AOT-компилятор. Ближе всех GraalVM Web Image: ФС в памяти, файлы только на чтение, без потоков. **[вывод]** Это значит, что `.rd5` придётся заранее целиком загружать в Jimfs, а это хуже, чем сейчас в CheerpJ.

## 2. Порты BRouter и читатели `.rd5`

**BeeRouter** (https://codeberg.org/jgillich/beerouter). «Started as a fork of BRouter… making the engine available as a Kotlin Multiplatform library». Использует те же `.brf`, `lookups.dat` и `.rd5`, умеет генерировать `.rd5` (планета, страна, POI, SRTM). JMH-бенчмарк в README: 14.99 ops/s против 15.98 ops/s у BRouter. Лицензия MPL-2.0, атрибуция BRouter. В `core/build.gradle.kts` объявлены только `jvm()` и `linuxX64()`. Все зависимости commonMain публикуют варианты `js` и `wasmJs`: kotlinx-io-core 0.8.2, androidx.collection 1.5.0, spatialk geojson 0.6.1 (проверено по `.module` на Maven). Доступ к данным спрятан за интерфейсом `MapSource { exists(); open(): RandomAccessReader }`, а `RandomAccessReader` — синхронный (`seek`/`readFully`). Под браузер его можно реализовать через память, OPFS SyncAccessHandle или синхронный XHR в Worker **[вывод]**. Используется в Android-приложении Atlas (vendored).
- https://codeberg.org/jgillich/beerouter , https://repo1.maven.org/maven2/dev/skynomads/beerouter/

**stefanhoelzl/tracks, модуль `app/brouter`.** Ядро BRouter v1.7.10 (codec, expressions, mapaccess, router, util) сконвертировано IntelliJ J2K и скриптовыми проходами-фиксами. Шимы `java.io` написаны поверх Okio. Таргеты: jvm, linuxX64, iOS. Критерий готовности — побайтовое совпадение с ответами brouter.de. Найдено два тихих изменения поведения: `(int) x` → `x as Int` и сужение `float += double`. Рекурсия `cleanupPeninsulas` переписана в цикл. MIT.
- https://github.com/stefanhoelzl/tracks/tree/main/app/brouter (README модуля)

**Atlas (Android).** Режет векторные тайлы OpenMapTiles из `.pmtiles` в `.rd5` и запускает над ними BeeRouter. Это прецедент для п.5c.
- https://github.com/Mobile-Artificial-Intelligence/atlas

**Порт на Rust, Go, C++ или JS/TS** не найден. Искал по GitHub репозитории «brouter» во всех языках и код с `MicroCache2`/`segments4` в rust, go, ts, js, c++, swift, c. Нашлись только клиенты HTTP API (`jelmer/brouter-client-rs`, `react-native-brouter` и др.) и фронтенды. Читателей `.rd5` не на JVM, кроме Kotlin/Native-сборок 2a/2b, нет.

**Формат `.rd5`** (из исходников BRouter). Заголовок 200 байт, в нём 25 смещений: по одному на каждый 1°×1° внутри тайла 5°×5°. У каждого градуса свой индекс из divisor² int-позиций, в новом формате divisor = 32, то есть 1024 микро-кэша по 1/32°. **[вывод]** Такая структура позволяет читать нужные микро-кэши по HTTP Range, не скачивая файл целиком: 200 Б заголовка, затем ~4 КБ индекса градуса, затем нужные блобы.
- https://github.com/abrensch/brouter/blob/master/brouter-mapaccess/src/main/java/btools/mapaccess/PhysicalFile.java , .../OsmFile.java

## 3. Роутеры на Rust с Wasm и переписывание ядра

**route_snapper.** Плагин MapLibre, Rust → Wasm (wasm-pack), использует petgraph и rstar. Граф одним предсобранным файлом на фиксированную область. Профилей нет, задача — «прилипание» маршрута к сети. Демо: https://dabreegster.github.io/route_snapper. В README в идеях: «generating graph files on-the-fly from vector tile data».
- https://github.com/dabreegster/route_snapper

**routx.** OSM → взвешенный граф, A*, профили (CAR, BUS, BICYCLE, FOOT, RAILWAY, TRAM, SUBWAY), учитывает oneway, access и запреты поворотов. Есть C/C++ биндинги. Сборка под wasm не заявлена.
- https://github.com/MKuranowski/routx

**osm4routing2.** OSM PBF → CSV-граф. Это экстрактор, не роутер. https://github.com/rust-transit/osm4routing2

**fast_paths.** Contraction Hierarchies. В README отдельно описано, как подготовить граф для 32-битной WebAssembly. Веса фиксируются на этапе подготовки, переключать профили на лету нельзя. https://github.com/easbar/fast_paths

**A/B Street.** Rust + wasm-pack. В `map_model/src/pathfind` используется fast_paths, есть пешие и вело-движки. Новые проекты (15m, ltn, speedwalk) также Rust + wasm. https://github.com/a-b-street

**mpee.** Rust → Wasm с живым демо в браузере, но это car/VRP, а лицензия в репо отсутствует. https://github.com/punnerud/mpee

**Крейты для переписывания** (crates.io): pathfinding 4.16.0 (2026-09), petgraph 0.8.3, fast_paths 1.0.0, osmpbf 0.3.8, osmpbfreader 0.19.1, wasm-bindgen 0.2.129 (2026-09), rstar 0.13.0, geo 0.33.1, pmtiles 0.24.1 (2026-10), flatgeobuf 6.0.1.

**Прецеденты переноса.** JVM → Rust для роутера не найдено. JVM → Kotlin Multiplatform для самого BRouter есть дважды (2a, 2b), и в обоих случаях с тестами паритета. **[вывод]** Самая дорогая часть переписывания на Rust — язык профилей `.brf` (модуль expressions) и кодек `.rd5`, а A* и wasm-обвязка уже готовы в крейтах.

## 4. Готовые роутеры в браузере

**tobilg/valhalla-wasm.** Пакеты `valhalla-browser` (Web Worker) и `valhalla-server` (Node, экспериментально Cloudflare Workers). Внутри Valhalla 3.8.3, Emscripten 6.0.0. Профили `auto`, `bicycle`, `pedestrian`, `truck` с `costing_options`. Тайлы `.gph` грузятся по требованию через HTTP Range из индексированного несжатого `graph.tar` или поштучно, кэш декодированных тайлов 32 MiB. Wasm весит 9 861 835 байт, память Wasm по умолчанию 64→256 MiB, потолок 1024 MiB. Бенчмарк на Лихтенштейне (данные 2015): длинный маршрут затронул 5 тайлов, 1.48 МБ; WebAssembly-память выросла до ~165.6 MiB. Чего нет: OPFS, IndexedDB, гарантии офлайна; мобильные устройства не проверялись. Билдер графа не добавляет высоты («does not add … elevation data»), поэтому **[вывод]** `use_hills` не будет работать без доработки сборки. Опции Valhalla: у bicycle есть `use_hills`, `use_roads`, `avoid_bad_surfaces`; у pedestrian есть `max_hiking_difficulty` по `sac_scale`, `use_tracks`, `step_penalty`. Демо: https://valhalla-browser.gh.tobilg.com
- https://github.com/tobilg/valhalla-wasm (README, `docs/building-graph-data.md`, `docs/regional-benchmarks.md`, `docs/regional-data.md`)
- https://valhalla.github.io/valhalla/api/route/api-reference/

**ecc521/valhalla-wasm.** Вынесен из rivers.run. Каждый тайл внутри `.tar` монтируется как лениво читаемый виртуальный файл, по README маршрут занимает «~20–50 MB». Готовый модуль ~7.4 МБ. По умолчанию данные читаются из OPFS, источник подменяемый (HTTP Range, IndexedDB). npm `valhalla-wasm` 0.1.0.
- https://github.com/ecc521/valhalla-wasm

**OSRM в Wasm.** Не существует. В issue #6525 «Intricacies of porting OSRM to WebAssembly» обсуждали отвязку от ФС и лимит памяти 4 ГБ, закрыто 2026-04-12 без реализации.
- https://github.com/Project-OSRM/osrm-backend/issues/6525

**GraphHopper в браузере.** Был только эксперимент TeaVM в 2014 году: GH 0.3-SNAPSHOT, данные на Лондон ~14 МБ JSON внутри HTML. На мобильных работало в 10 раз медленнее или падало. Современных Wasm-сборок не найдено.
- https://www.graphhopper.com/blog/2014/05/04/graphhopper-in-the-browser-teavm-makes-offline-routing-via-openstreetmap-possible-in-javascript/

**Itinero 2.** .NET. Тайловая сеть с загрузкой по требованию, профили считаются на каждый запрос (C# или Lua), только Dijkstra и A* без CH. Блоки по замыслу похожи на BRouter. Запуск в браузере (Blazor) не подтверждён.
- https://github.com/itinero/routing2

**pgRouting + PGlite.** В PGlite pgRouting нет. Среди расширений только экспериментальный `@electric-sql/pglite-postgis` 0.2.8. Упоминаний pgRouting в репозитории и issues PGlite нет.
- https://github.com/electric-sql/pglite/blob/main/docs/repl/allExtensions.ts , https://github.com/electric-sql/pglite/tree/main/packages/pglite-postgis

**routingjs.** Клиентская библиотека к API Valhalla, OSRM, ORS и GraphHopper, движком не является. https://github.com/nilsnolde/routingjs

## 5. Экзотика

**Векторные тайлы как граф.** В слое `transportation` OpenMapTiles есть поля `class`, `subclass`, `oneway`, `access`, `bicycle`, `foot`, `horse`, `mtb_scale`, `surface`, `brunnel`, `layer` и др. **[вывод]** Ограничения: геометрия режется по границам тайлов, линии склеиваются, OSM-узлы перекрёстков теряются, поэтому топологию придётся восстанавливать по совпадению координат. Высот в тайлах нет. Готового браузерного роутера по MVT не найдено. Ближайший прецедент — Atlas (2a): OMT → `.rd5` → BeeRouter, но на Android.
- https://openmaptiles.org/schema/

**PMTiles и FlatGeobuf как контейнер графа.** В PMTiles v3 есть тип тайла `0x00 Unknown/Other`, то есть в тайлах можно хранить произвольный бинарный груз; формат рассчитан на HTTP Range. **[вывод]** Туда можно положить, например, нарезку `.rd5` на микро-кэши. В FlatGeobuf упакованное Hilbert R-tree даёт выборку по bbox через Range.
- https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md , https://github.com/flatgeobuf/flatgeobuf

**geojson-path-finder.** Dijkstra по GeoJSON-сети, функция веса задаётся своя. Демо: https://www.liedman.net/geojson-path-finder/ . https://github.com/perliedman/geojson-path-finder

**ngraph.path.** A*, NBA*, Dijkstra на JS. Бенчмарк на графе дорог Нью-Йорка (264k узлов, 734k рёбер): NBA* в среднем 44 мс, A* 55 мс. Демо: https://anvaka.github.io/ngraph.path.demo/ . https://github.com/anvaka/ngraph.path

**DuckDB-Wasm.** Расширение spatial в wasm доступно. httpfs в браузере — отдельная JS-реализация, ограничена CORS. Расширение duckpgq собрано под `wasm_eh` (файл для v1.4.1 отдаётся с HTTP 200), но умеет только `ANY SHORTEST` без весов.
- https://duckdb.org/docs/current/clients/wasm/extensions.html , https://duckpgq.org/documentation/sql_pgq/ , https://github.com/cwida/duckpgq-extension

**sql.js-httpvfs.** SQLite только на чтение через HTTP Range, страница 1–4 КБ, кэш без вытеснения. Из README автора: «mainly written for small personal projects… virtual file system part doesn't have any tests». Последний коммит 2023-03. **[вывод]** Для графа подходит как индекс по тайлам, но для A* с тысячами случайных чтений Range-запросов будет слишком много.
- https://github.com/phiresky/sql.js-httpvfs

**Planner.js / Linked Routable Tiles.** Клиентский планировщик (транзит + пешком) поверх routable tiles по HTTP. Последний коммит 2023-02. https://github.com/openplannerteam/planner.js

## Что не удалось подтвердить

- Размер `.wasm` у GraalVM Web Image для приложений масштаба BRouter: цифр в официальных материалах нет.
- Сборку BeeRouter или tracks-порта под Kotlin/JS или Kotlin/Wasm никто не публиковал. Есть только факт, что зависимости это позволяют.
- Запуск Itinero 2 в браузере через Blazor WebAssembly.
- Сборку routx под wasm32 (в репо её нет; что она возможна, логично, но не проверено).
- Есть ли у ecc521/valhalla-wasm профили bicycle и pedestrian и высоты: в README явно не сказано.
- Работу tobilg/valhalla-wasm на мобильных: автор сам пишет «not established».
- Существует ли где-то OSRM в Wasm: ни репозиториев, ни демо не нашёл.
- pgRouting в любой Wasm-сборке Postgres: не найдено.
- Готовый роутинг по MVT/PMTiles в браузере: не найдено, есть только Android-прецедент Atlas.
- Насколько слой `roads` Protomaps годится для роутинга (набор тегов): не проверял.
- Почему BeeRouter распространяется под MPL-2.0, если BRouter под MIT: в README только ссылка на ATTRIBUTION, сам файл не читал.
