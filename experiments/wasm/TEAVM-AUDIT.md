# BRouter → TeaVM: статический аудит

Ревизия BRouter: `29898106` (1.7.11-beta), модули `brouter-{core,mapaccess,expressions,codec,util}/src/main` — 18.4 тыс. строк, 101 класс. Bytecode target — Java 11 (`buildSrc/src/main/groovy/brouter.java-conventions.gradle:19`), лицензия MIT.
TeaVM проверялась по `konsoletyper/teavm@master` (GitHub API, 2026-10-06) и по teavm.org/docs. Пути BRouter ниже — относительно `brouter-src/`. Пути TeaVM — относительно корня репозитория TeaVM.

## TL;DR

- **Компилировать реально.** Всё, что BRouter берёт из JDK на пути маршрутизации (File, RandomAccessFile, FileReader, regex, String.format, DecimalFormat, SimpleDateFormat, synchronized, Thread), в classlib TeaVM есть. Сборку ломают два места: `StackSampler` (`Thread.getAllStackTraces`, `Locale.Builder`) и `Class.forName` в `RoutingContext.setModel`.
- **Главная проблема — синхронный I/O, а не компиляция.** Чтение тайла вызывается внутри A*-цикла (`RoutingEngine.java:2198`, `:2218` → `NodesCache.obtainNonHollowNode` → `OsmFile.readFully`). Лучший путь: гонять движок в Web Worker, а чтение делать синхронно через sync XHR с `Range` или через OPFS `FileSystemSyncAccessHandle`. Тогда архитектуру BRouter менять не нужно.
- **Гипотеза про HTTP Range подтверждается, причём с запасом.** Минимальная единица чтения — не 1°-подтайл, а ячейка 1/32° (примерно 2.6×3.5 км на широте Тбилиси). По Грузии: медиана ячейки 0.6–0.8 КБ, p99 около 10 КБ.
- Оценка: правки BRouter затрагивают 4–6 классов и ~100–150 строк. Нового кода (entry point, I/O, worker, интеграция) ~400–600 строк. **PoC за 1–2 дня, рабочая версия за 5–9 дней.** Основной риск — производительность A* в JS/Wasm, её никто не мерил.

---

## 1. Файлы и потоки на пути маршрутизации

### 1.1. Что умеет TeaVM в java.io (первоисточник)

| Класс TeaVM | Есть | Как работает |
|---|---|---|
| `classlib/.../java/io/TRandomAccessFile.java` | да | Реализован через `org.teavm.runtime.fs.VirtualFileAccessor`. `seek(long)` приводится к `int` (`accessor.seek((int) pos)`), так что файлы ограничены 2 ГБ. Для тайлов .rd5 (17–31 МБ) этого достаточно. |
| `TFile`, `TFileInputStream`, `TFileReader`, `TFileWriter(File, boolean)` | да | Все работают через `VirtualFileSystemProvider.getInstance()`. |
| `core/.../runtime/fs/VirtualFileSystemProvider.java` | — | По умолчанию `create()` возвращает **`InMemoryVirtualFileSystem`**: файловая система в памяти, данные лежат в `byte[]` (`runtime/fs/memory/InMemoryVirtualFile.java`). Для C-бэкенда её подменяет `VirtualFileSystemProviderTransformer`. Есть публичный `setInstance(VirtualFileSystem)`, так что можно подключить свою ФС (например, с чтением через XHR или OPFS). Это пакет `org.teavm.runtime.fs` из `teavm-core`, и в документации он не описан: **это внутренний API, есть риск**. |
| `VirtualFileAccessor` | — | Интерфейс синхронный: `read/seek/size/tell` и т.д., везде `int`. |
| `TSystem.getProperty` | да | Работает на `Properties` с дефолтами (`java.version`, `os.name=TeaVM`, …). `setProperty` есть. Для неизвестного ключа возвращается `null`, так что `Boolean.getBoolean(...)` даёт `false`. |
| `TSystem.currentTimeMillis/nanoTime` | да | — |

Вывод: код с `File`/`RandomAccessFile` **компилируется без правок**. Чтобы он работал, достаточно положить файлы в in-memory ФС TeaVM или подменить ФС своей.

### 1.2. Места в BRouter (только путь маршрутизации)

| Файл:строка | API | Когда срабатывает | Что сделать под TeaVM |
|---|---|---|---|
| `brouter-mapaccess/.../PhysicalFile.java:95-96` | `new RandomAccessFile(f,"r")`, `readFully(200)` | открытие .rd5 | ФС с Range-доступом или заменить RAF на интерфейс `RandomReader` |
| `PhysicalFile.java:110` | `ra.length()` | открытие | длина файла: через HEAD или из `Content-Range` первого ответа |
| `PhysicalFile.java:125-126` | `seek(fileIndex[24])`, `readFully(113)` | открытие (футер) | то же |
| `brouter-mapaccess/.../OsmFile.java:63-64` | `seek`, `readFully(4096)` | первое обращение к 1°-квадрату | то же |
| `OsmFile.java:110-112` | `seek`, `readFully(size)` | каждая новая ячейка 1/32° (**внутри A***) | то же; это горячая точка I/O |
| `brouter-mapaccess/.../NodesCache.java:82` | `segmentDir.isDirectory()`, `getAbsolutePath()` | `new NodesCache` | VFS: каталог должен существовать |
| `NodesCache.java:364-372` | `new File(...).exists()` для primary и secondary | открытие .rd5 | VFS: `exists` у своей ФС. Отдельно проверить `new File((File) null, name)` в TeaVM: `secondarySegmentsDir` обычно `null` |
| `NodesCache.java:58`, `RoutingEngine.java:94` | `Boolean.getBoolean("disableDirectWeaving")` | static/init | ничего: вернёт `false` |
| `NodesCache.java:392-401` | `ra.close()` после **каждого** `doRouting` (`RoutingEngine.java:368`) | конец запроса | кеш байтов держать на своём уровне, иначе заголовки перечитываются на каждый запрос |
| `brouter-mapaccess/.../StorageConfigHelper.java:24-26` | `FileReader(storageconfig.txt)` | `new NodesCache` | ничего: исключение глотается (`:39`), возвращается `null` |
| `brouter-core/.../ProfileCache.java:34` | `System.getProperty("profileBaseDir")` | `parseProfile` | `System.setProperty` при инициализации |
| `ProfileCache.java:38-46,49,55` | `File`, `lastModified()` | `parseProfile` | in-memory VFS отдаёт `lastModified`, правок не нужно |
| `ProfileCache.java:114,122` | `currentTimeMillis` | LRU профилей | ничего |
| `ProfileCache.java:29,33,126` | `static synchronized` | — | ничего: TeaVM поддерживает (см. п. 2) |
| `brouter-expressions/.../BExpressionMetaData.java:35` | `BufferedReader(FileReader(lookups.dat))` | парсинг профиля | VFS **или** перегрузка с `Reader`/`String` |
| `brouter-expressions/.../BExpressionContext.java:814,857` | `file.exists()`, `BufferedReader(FileReader(.brf))` | парсинг профиля | VFS **или** перегрузка с `Reader` |
| `BExpressionContext.java:85,118` | `Boolean.getBoolean(...)` | init | ничего |
| `brouter-util/.../CompactLongMap.java:41` | `Boolean.getBoolean(...)` | init | ничего |
| `brouter-core/.../RoutingEngine.java:112-133` | `File`, `exists`, `FileWriter(debug.txt)`, `new StackSampler` | конструктор | при `profileBaseDir` значение `localFunction` — голое имя, `getParentFile()` вернёт `null`, и в рантайме ветка не выполняется. **Но `StackSampler` статически достижим и не скомпилируется** (п. 3). Вырезать или подменить заглушкой. |
| `RoutingEngine.java:207,346,1779,1843,2027,2093-2095` | `currentTimeMillis` (таймаут `maxRunningTime`) | `doRun` | ничего |
| `RoutingEngine.java:327` | `System.getProperty("reportFormat")` | `outfileBase == null` | ничего |
| `RoutingEngine.java:330-332` | `System.out.println(new FormatGpx(rc).format(track))` | `outfileBase == null && !quite` | выставить `re.quite = true`, иначе на каждый маршрут строится GPX и печатается в консоль |
| `RoutingEngine.java:595`, `AreaReader.java:129,221,239` | `File`/`FileInputStream`/`FileOutputStream` | только round-trip с `rawAreaPath` | ничего (компилируется, не вызывается) |
| `RoutingEngine.java:952`, `OsmTrack.java:218-239` | `readBinary`/`writeBinary` | только при `rawTrackPath != null` | ничего |
| `FormatGpx.java:542-547`, `Formatter.java:50` | `FileInputStream`, `FileWriter` | только при `outfileBase != null` | ничего |

Вне пути и не трогаем: `Rd5DiffTool`, `Rd5DiffManager`, `Rd5DiffValidator`, `ProfileComparator`, `IntegrityCheckProfile`, `PhysicalFile.main/checkFileIntegrity`.

### 1.3. Формат .rd5 и что читается когда (`PhysicalFile.java`, `OsmFile.java`)

```
[0..200)          fileIndex: 25 × int64 big-endian. Старшие 16 бит первого — lookupVersion,
                  младшие 48 бит каждого — абсолютный КОНЕЦ i-го 1°-подтайла.
                  Подтайл i = (lon%5)*5 + (lat%5), начинается в fileIndex[i-1] (или 200).
[200..idx[24])    25 подтайлов подряд. Каждый:
                    индекс ячеек: divisor² × int32 (divisor=32 → 4096 Б; старый формат 80 → 25600 Б),
                      posIdx[k] = конец ячейки k относительно начала подтайла,
                      первая ячейка начинается сразу после индекса;
                    данные ячеек (MicroCache2, bit-coded) + CRC32 в хвосте каждой.
[idx[24]..EOF)    футер 113 Б: creationTime(8) + CRC заголовка(4, xor 2 → divisor=32)
                  + 25 × CRC индексов подтайлов(100) + elevationType(1).
```

| Момент | Что читается | Объём |
|---|---|---|
| Первое обращение к 5°-файлу (`NodesCache.fileForSegment` → `new PhysicalFile`) | заголовок 0..200, `length()`, футер | 200 Б + 113 Б + размер файла |
| Первое обращение к 1°-квадрату (`new OsmFile`) | индекс ячеек подтайла, проверка CRC по футеру | 4 КБ |
| Каждая новая ячейка 1/32° (`getSegmentFor` → `createMicroCache` → `getDataInputForSubIdx`) | ровно `[fileOffset+posIdx[k-1], fileOffset+posIdx[k])` | по Грузии, замер на локальных тайлах: E40_N40 (30.7 МБ) — медиана 763 Б, p90 3.5 КБ, p99 11 КБ, максимум 121 КБ; E45_N40 (17.7 МБ) — медиана 628 Б, максимум 68 КБ. Пустых ячеек 22–47 %. |

Гипотеза «заголовок плюс нужные 1°-подтайлы по HTTP Range» **подтверждается**. Формат позволяет и более мелкую гранулярность: каждую ячейку можно запрашивать отдельным Range. Размеры 1°-подтайлов по Грузии 0.01–3.6 МБ. Компромисс такой: тянуть подтайл целиком (меньше запросов, 1–3.6 МБ на квадрат) или ячейку по Range (байты экономятся, но запросов десятки–сотни, и каждый блокирует A*). Нюанс: если ячейка больше `iobuffer` (65636 Б, `DataBuffers.java:12`), `OsmFile.createMicroCache:128-131` читает её второй раз. Слой кеша это поглотит.
Поддержку Range и CORS на `brouter.de/brouter/segments4` не проверял. Для локального сценария (свой статический сервер) это не важно.

---

## 2. Потоки и синхронность

| Место | Что | Критично? |
|---|---|---|
| `RoutingEngine.java:32` | `extends Thread`, `run()` → `doRun(0)` | нет: `doRun(timeout)` **синхронный**, его можно звать напрямую |
| `RoutingEngine.java:69,2021,2478` | `volatile terminated`, `terminate()` из другого потока | нет: в браузере отмена — `Worker.terminate()` или таймаут `maxRunningTime` |
| `RoutingEngine.java:2011,2032,2399,2409` | `synchronized (openSet)` | нет: защищает `getOpenSet()` для визуализации в Android-приложении |
| `ProfileCache.java:29,33,126` | `static synchronized` | нет |
| `brouter-util/.../StackSampler.java:14` | `extends Thread`, `getAllStackTraces` | в рантайме не используется, но **ломает компиляцию** |
| ExecutorService / Timer / wait / notify / Atomic* / Concurrent* | **не найдено** | — |

Что TeaVM говорит о потоках: `Thread`, `synchronized`, `wait/notify` эмулируются корутинами ([coroutines.html](https://teavm.org/docs/runtime/coroutines.html)). С 0.13 корутины работают и в Wasm GC ([release 0.13.0](https://github.com/konsoletyper/teavm/releases/tag/0.13.0)). Поэтому `synchronized` компилируется на обоих бэкендах.

### Синхронный I/O из браузера: варианты

Цепочка вызова: `RoutingEngine._findTrack` → `nodesCache.obtainNonHollowNode(nextNode)` (`RoutingEngine.java:2198,2218`, внутри цикла A*) → `NodesCache.getSegmentFor:189` → `OsmFile.createMicroCache` → `RandomAccessFile.readFully`. Ещё точки: `matchWaypointsToNodes` (`NodesCache.java:292-345`, предзагрузка 3×3 или 5×5 ячеек вокруг точки) и `getStartNode`. Async-разрыв пришёлся бы на середину горячего цикла.

| Вариант | Правки BRouter | Плюсы | Минусы |
|---|---|---|---|
| **A. Web Worker + синхронное чтение** | 0 в логике (нужна только своя ФС или обёртка RAF) | архитектура не меняется | только в Worker. Sync XHR с `responseType=arraybuffer` разрешён **только в Worker** ([MDN responseType](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseType)). Каждый промах кеша блокирует поток на сетевую задержку. |
| A′. то же, но через OPFS | 0 | `FileSystemSyncAccessHandle.read(buf, {at})` синхронный, есть только в dedicated worker ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemSyncAccessHandle/read)). Тайл скачивается один раз (async) и дальше читается мгновенно. | `createSyncAccessHandle()` возвращает Promise, поэтому handle надо открыть до `doRun`. Тайл должен быть скачан целиком (17–31 МБ на 5°). |
| B. Корутины TeaVM: `@Async` поверх fetch | 0 в логике | TeaVM сам делает CPS-трансформацию. Готовый пример — `TXHRURLConnection.performRequest` (`classlib/.../java/net/impl/TXHRURLConnection.java:86-130`). | Async становятся все методы, транзитивно ведущие к чтению, включая цикл A*. Накладные расходы в документации не описаны. Вызов допустим только из Java-потока, иначе ошибка `Suspension point reached from non-threading context` (`core/.../backend/javascript/thread.js:104`, `core/.../runtime/Fiber.java:242`). Значит, экспорт должен стартовать `new Thread` и отдавать результат колбэком. |
| C. Предзагрузка и рестарт | ~30 строк в `NodesCache` | без корутин и без Worker | на промахе бросать исключение со списком ячеек, догружать async и перезапускать маршрут. На длинных маршрутах много рестартов. |
| D. Весь 5°-тайл в in-memory ФС TeaVM | **0** | быстрее всего для PoC: JS скачивает .rd5, кладёт байты в VFS через `FileOutputStream`, BRouter работает как на JVM | ~31 МБ на тайл в памяти (×2 при копировании). Без Worker блокирует UI на время A*. |

Рекомендация: **сначала D (PoC), затем A′** — Worker, полный тайл в OPFS и синхронный handle. Если тайлы не хочется качать целиком, то **A**: Worker, sync XHR Range по 1°-подтайлам и кеш байтов. NodesCache и OsmFile при этом не трогаются.

---

## 3. Рефлексия и «динамика»

| Файл:строка | Что | Поддержка TeaVM | Что сделать |
|---|---|---|---|
| `brouter-core/.../RoutingContext.java:91-92` | `Class.forName(className).getDeclaredConstructor().newInstance()` — модель пути из `---model:` в .brf | `TClass.forName` ищет в `nameMap` (`classlib/.../java/lang/TClass.java:579-588`), куда попадают только классы, явно помеченные для рефлексии (новый API 0.15: `.foundByName()`, [release 0.15.0](https://github.com/konsoletyper/teavm/releases/tag/0.15.0)). Иначе `ClassNotFoundException` в рантайме. | заменить на `switch` (`StdModel`/`KinematicModel`), ~5 строк. В `misc/profiles2` `---model:` есть только у `car-vario.brf` (`KinematicModel`). Пешие и вело-профили используют `StdModel` и в эту ветку не заходят. |
| `brouter-util/.../StackSampler.java:57,15,107,115` | `Thread.getAllStackTraces()`, `new Locale.Builder()`, `Class.forName`, `getMethod().invoke` | `getAllStackTraces` в `TThread.java` **нет**. `Locale.Builder` в `TLocale.java` **нет**. | убрать ссылку из `RoutingEngine.java:126-131` (`new StackSampler` на `:128`) или подложить заглушку `StackSampler` в браузерной сборке |
| `brouter-core/.../MessageData.java:69` | `clone()` | `TObject.clone` есть | ничего |
| `brouter-expressions/.../BExpressionContext.java:569-681` | `String.matches/replaceAll/split`, `String.format(Locale.US, "%3.1f")` | `TString.matches/split/replaceAll` идут через `TPattern`. В `TFormatter` есть `'f'`. | ничего; проверить совпадение `%3.1f` с JVM |
| `brouter-core/.../FormatJson.java:72,74` | `replaceAll("\t", ...)` | есть | ничего |
| `FormatJson.java:82-83` | `NumberFormat.getInstance(Locale.ENGLISH)` + `applyPattern("0.###")` | `TDecimalFormat.applyPattern`, `TNumberFormat.getInstance(TLocale)` есть. Локали требуют CLDR-данных ([java-classes.html](https://teavm.org/docs/runtime/java-classes.html), раздел про локали). | включить локаль `en` в сборку |
| `brouter-core/.../Formatter.java:122-125` | `SimpleDateFormat`, `TimeZone.getTimeZone("UTC")` | классы есть | только GPX. Статически достижимо, поэтому раздувает бандл |
| `brouter-core/.../RoutingParamCollector.java:112` | `URLDecoder.decode` | `TURLDecoder` есть | нам не нужен: `RoutingContext` собираем напрямую |
| Proxy / ServiceLoader / Serializable / ObjectStream / `java.nio` / `java.util.zip` | **не найдено** на пути (свой `Crc32` в `brouter-util`) | — | — |

---

## 4. Прочие несовместимости

| Тема | Что в BRouter | TeaVM | Риск |
|---|---|---|---|
| `long` | node id = `(long) ilon << 32 \| ilat` (`OsmNode.java:202`), `CompactLongMap/Set`, `FrozenLongMap`, `DirectWeaver`, `MicroCache2`, `ByteDataReader.readLong`. Ядро A* (`SortedHeap`, стоимости) — `int` и `float`. | JS-бэкенд: `long` — это **BigInt** с `BigInt.asIntN(64, …)` на каждой операции (`core/.../backend/javascript/long.js:19-60`), то есть медленно. Wasm GC: нативный i64. | средний для JS: long в основном в декодировании ячеек и хешах. Это довод за Wasm GC. |
| `float` | выражения профиля и стоимость — `float` | в `numeric.js` и рендерере JS-бэкенда поиск `fround` ничего не нашёл. Скорее всего, float считается с двойной точностью. **Не подтверждено.** В Wasm GC f32 нативный. | стоимости могут чуть отличаться от JVM: при равных стоимостях возможен другой маршрут. Сверить с сервером. |
| `double` → строка | высоты в GeoJSON (`", " + n.getElev()`), `DecimalFormat` | своя реализация в classlib | косметика: формат чисел может отличаться от JVM |
| `Math` | `abs/min/max/sqrt/exp/cos/sin/atan/round/random` | стандартные | нет |
| Память | `memoryclass=64` (`RoutingContext.java:54`): кеш тайлов `maxmem/8`, nodesMap `2/3·maxmem` (`NodesCache.java:65-68`). `catch (Error)` → `cleanOnOOM` (`RoutingEngine.java:353-354`). | в браузере OOM не ловится как `Error` | низкий для локальных маршрутов. Для вариантов D/A′ добавить 30–60 МБ на тайлы в памяти. |
| Большие массивы | `fileRows[180]`, `iobuffer` 64 КБ, индексы ячеек 32×32 | ок | нет |
| Ошибки | `doRun` глотает исключения и пишет их в `errorMessage` (`RoutingEngine.java:347-356`, `:842-845`) | — | entry point обязан проверять `re.getErrorMessage()` |

---

## 5. TeaVM: версии и бэкенды (первоисточник)

| Версия | Дата | Главное |
|---|---|---|
| **[0.16.0](https://github.com/konsoletyper/teavm/releases/tag/0.16.0)** (текущая) | 2026-10-02 | C-бэкенд догнал JS и Wasm GC по рефлексии. Record-style `@JSProperty`, WebGPU в JSO, Maven toolchains. |
| [0.15.0](https://github.com/konsoletyper/teavm/releases/tag/0.15.0) | 2026-06-14 | TeaVM требует Java 17 для запуска. Новый API рефлексии (`selectClasses(...).foundByName()`), `java.lang.reflect.Proxy`. Wasm GC эмитит `try_table` (exnref). |
| [0.14.0](https://github.com/konsoletyper/teavm/releases/tag/0.14.0) | 2026-05-02 | **Удалены** старый (non-GC) Wasm и WASI. Рефлексия переписана. Линковка с emscripten. |
| [0.13.0](https://github.com/konsoletyper/teavm/releases/tag/0.13.0) | 2025-11-03 | **Корутины в Wasm GC** (Thread, sleep, synchronized). Импорт памяти и `SharedArrayBuffer`, Java 25. |

Бэкенды: **JavaScript**, **WebAssembly GC**, **C** ([getting-started](https://teavm.org/docs/intro/getting-started.html)). Методы Wasm GC экспортируются через `@JSExport`/JSO, вызываются синхронно, модуль загружается через `Promise` ([loader](https://teavm.org/docs/wasm-gc-backend/loader.html)). wasm-файлы нужно отдавать по HTTP.

Поддержка Wasm GC и exnref в браузерах (таблица `WebAssembly/website/features.json`): GC — Chrome 119, Firefox 120, Safari 18.2. exnref (`try_table`, его TeaVM эмитит с 0.15) — **Chrome 137, Firefox 131, Safari 18.4**.

Список поддерживаемых классов JDK: <https://teavm.org/jcl-report/recent/jcl.html>. Сам TeaVM признаёт, что часть классов ведёт себя не на 100 % как в JVM ([java-classes.html](https://teavm.org/docs/runtime/java-classes.html)).

Чего не нашёл: замеров накладных расходов корутин TeaVM и сравнения производительности JS и Wasm GC в официальной документации нет.

---

## 6. Итог

### Объём правок BRouter (минимальный вариант: D, потом A/A′)

| Класс | Правка | Строк |
|---|---|---|
| `RoutingContext` | `Class.forName` → `switch` | ~5 |
| `RoutingEngine` | убрать `StackSampler` и `debug.txt` из конструктора (или заглушка `StackSampler`) | ~20 |
| `PhysicalFile`, `OsmFile` | *опционально*: RAF → интерфейс `RandomReader` (если не подменять VFS TeaVM) | ~30 |
| `BExpressionMetaData`, `BExpressionContext`, `ProfileCache` | *опционально*: перегрузки с `Reader`/`String` вместо `File` (если не класть файлы в in-memory VFS) | ~40–60 |
| **Итого** | 2 обязательных класса, до 7 с опциональными | **~25 обязательных, до ~150** |

Новый код: Java entry point с `@JSExport` (сборка `RoutingContext`, `keyValues` для `profile:*`, waypoints, `quite=true`, `doRun`, `FormatJson`, `getErrorMessage`) — ~150 строк. Слой I/O (VFS или `RandomReader` поверх sync XHR/OPFS, кеш байтов между запросами) — ~150 строк. Worker и замена `fetchRoute` в `lib/brouter` nakarte — ~150–200 строк. Сборка Gradle с TeaVM-плагином отдельным модулем, чтобы не трогать апстрим BRouter.

### Главные риски

1. **Производительность A*** в JS/Wasm против JVM не измерена. В JS-бэкенде `long` идёт через BigInt. Wasm GC требует Chrome 137+, Firefox 131+, Safari 18.4+.
2. **Синхронный I/O возможен только в Worker.** При чтении по ячейкам каждый промах — блокирующий сетевой запрос. Сколько ячеек трогает типичный маршрут, неизвестно: нужно залогировать `getSegmentFor` на JVM.
3. **Отличия от сервера:** точность float, форматирование чисел. Маршруты нужно сверять с docker-BRouter на наборе точек.
4. Кастомная `VirtualFileSystem` — внутренний API TeaVM, может сломаться при обновлении. Интерфейс `RandomReader` в BRouter надёжнее, но это правка форка.
5. Размер бандла: в него попадают GPX, KML, CSV, `SimpleDateFormat`, `TimeZone`, regex. Насколько dead-code elimination всё это вырежет, станет ясно только после сборки.
6. Хостинг тайлов: нужны Range и CORS. Для локального сервера это не проблема, для `brouter.de` не проверено.

### Трудозатраты (грубо)

| Этап | Дни |
|---|---|
| PoC: модуль сборки TeaVM, 2 обязательные правки, тайл, lookups и .brf целиком в in-memory VFS, маршрут Тбилиси–Мтацминда в Worker | 1–2 |
| I/O: OPFS-кеш тайлов или Range по 1°-подтайлам, кеш байтов между запросами | 1–2 |
| Интеграция в nakarte: активности и `profile:*`, отмена, индикатор, фоллбек на docker | 1–2 |
| Сверка с сервером, замеры JS и Wasm GC, тюнинг (`memoryclass`, предзагрузка) | 2–3 |
| **Итого** | **5–9** |
