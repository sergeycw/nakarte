# Handoff: расчёт маршрута в браузере

Документ для агента, который продолжает трек. Цифры и доказательства лежат в `REPORT.md`, аудит TeaVM — в `TEAVM-AUDIT.md`, обзор остальных вариантов — в `ALTERNATIVES.md`. Здесь только состояние, подвохи и следующий шаг.

## Цель

`fetchRoute(from, to, activityId)` из `src/lib/brouter/index.js` считает маршрут в браузере и возвращает тот же массив `L.LatLng`, что сейчас. Сервер только раздаёт статику: jar, профили, тайлы `.rd5`. Зачем: автор nakarte не вливает роутинг (issue #10) из-за стоимости сервера-роутера.

## Состояние на 2026-10-06

Шаги 1–3 исходного ТЗ сделаны, шаг 4 ждёт ответа пользователя на `REPORT.md`.

- Эталон: `baseline/`, 3 маршрута × 2 профиля с серверного BRouter.
- Прототип на CheerpJ 4.3 считает все 6 маршрутов. Длина и число точек совпадают с сервером в точности. 10 км на прогретом движке: 0.3–0.55 с, на сервере 0.08–0.15 с.
- Тайлы читаются через HTTP Range силами самого CheerpJ: файловая система `/app/` читает файл кусками по 128 КБ.
- Слабые места:
  - холодный старт ≈5–6 с;
  - 0.6–0.8 ГБ RSS на вкладку;
  - лицензия: бесплатно только с их CDN.
- Решения за пользователем:
  1. Идти ли в шаг 4 на CheerpJ, как рекомендует отчёт, или сначала сделать спайк BeeRouter → `wasmJs` или PoC на TeaVM.
  2. Что делать с запросами, пока единственный поток CheerpJ занят: очередь FIFO или отмена устаревших.

Ничего не закоммичено: `experiments/` в worktree не отслеживается git.

## Рабочее место

- Worktree `../nakarte-wasm`, ветка `exp/brouter-wasm` от `master` (`66816ea`).
- `../nakarte/` — ежедневная версия пользователя. Ветку там не переключать, файлы не править.
- Контейнер `nakarte-brouter` общий: пользоваться можно, перезапускать нельзя. Поэтому `yarn local` из worktree не запускать: он делает `docker compose up` с тем же `container_name`.
- Порты:
  - 8765 — nakarte пользователя;
  - 8766 — dev-сервер worktree, запись `nakarte-wasm` в `../.claude/launch.json`;
  - 8767 — стенд замеров, запись `nakarte-wasm-bench`.
- `brouter/segments4` в worktree — симлинк на тайлы из `../nakarte`. `.gitignore` его не ловит, потому что правило там со слешем на конце.
- Исходники BRouter для патчей — ревизия образа `29898106b555e342ff3ade7ae3e9c1ae6644a43b` из `github.com/abrensch/brouter`. Клонировать заново: scratchpad прошлой сессии не сохраняется.
- Браузерные проверки пользователь просит делать через Claude in Chrome, а не через Playwright.

## Файлы эксперимента

| Файл | Роль |
|---|---|
| `routes.json` | эталонные маршруты и профили |
| `baseline/run.mjs` | снимает эталон с `localhost:17777` |
| `serve.mjs` | статика с Range, `/__stats`, `DELAY_MS`, прокси рантайма `/cjrt/`, `COI=1` |
| `cheerpj/build.sh` | достаёт jar и профили из контейнера, собирает обёртку и патч |
| `cheerpj/java/WasmRouter.java` | `route(segmentDir, profileDir, query)` повторяет `RouteServer` без сокетов, `probe(path)` показывает, как CheerpJ видит путь |
| `cheerpj/patch/` | копия `NodesCache` с пропуском `isDirectory()` для `/app/` |
| `cheerpj/index.html` | стенд: `fs=str\|app`, `rt=proxy`, `repeat`, `only`; наружу выставлены `window.__bench` и `window.__WasmRouter` |
| `cheerpj/bench.mjs` | headless-прогон через Playwright, оставлен для истории |

## Подвохи CheerpJ, проверенные на практике

Ни один из них в документации CheerpJ не описан.

- `/str/` плоская: `cheerpOSAddStringFile('/str/a/b')` Java не находит, `/str/b` находит.
- В `/app/` нет каталогов. `stat` делается запросом `Range: bytes=0-0`, длина берётся из `Content-Range`, `isDirectory()` всегда `false`. `NodesCache` из-за этого падает с `segment directory ... does not exist`. Отсюда патч.
- Отрицательный `stat` CheerpJ не кеширует. `NodesCache` создаётся несколько раз за маршрут, поэтому в патче проверка префикса `/app/` должна стоять до `isDirectory()`, иначе каждый маршрут делает ~6 лишних запросов.
- `StorageConfigHelper` на каждый маршрут читает `<segmentDir>/storageconfig.txt`. Отдавать пустой файл, чтобы не было лишнего 404.
- На страницу разрешён один library-поток: второй `cheerpjRunLibrary` бросает `Only one library thread supported`. Значит, одна инициализация на страницу, а `WasmRouter` переиспользуется.
- Тайлам с другого origin нужны CORS и `Access-Control-Expose-Headers: Content-Range`.
- JDK (`11/lib/modules`, 43 МБ, читается кусками через Range) грузится из cross-origin iframe `c.html`. Эти запросы не видны ни CDP-сессии страницы, ни Claude in Chrome. Чтобы посчитать байты, нужен `rt=proxy`: рантайм идёт через `/cjrt/` стенда и попадает в `/__stats`.
- Loader берёт базовый URL из своего `src`, поэтому прокси работает без настройки.
- `performance.measureUserAgentSpecificMemory()` работает только при `COI=1` и `rt=proxy` и показывает лишь JS-кучу. Память считать по RSS процесса.
- Claude in Chrome блокирует ответ `javascript_tool`, если в нём есть URL с query-строкой. Перед возвратом вырезать URL.
- Во фоновой вкладке rAF не тикает. Блокировку главного потока мерить через `MessageChannel`-пинг.
- Лицензия Community: рантайм только с `cjrtnc.leaningtech.com`, нужно указать авторство. Self-hosting и прокси — только для замеров.

## Шаг 4, когда пользователь даст добро

Интеграция в nakarte за флагом, контракт `fetchRoute` не меняется.

1. **Флаг.** В `src/config.js` рядом с `routingServer` появляется `routingEngine: 'server' | 'browser'`, по умолчанию `'server'`. Готово, когда с `'server'` поведение побайтно прежнее.
2. **Движок.** Модуль рядом с `src/lib/brouter/index.js`:
   - ленивая инициализация: динамический `loader.js` → `cheerpjInit({version: 11})` → один `cheerpjRunLibrary`;
   - очередь запросов по политике, которую выберет пользователь;
   - вызов `WasmRouter.route` с той же query-строкой, что сейчас уходит на сервер, вместе с `profile:` переопределениями активности.

   Готово, когда `fetchRoute` в режиме `'browser'` возвращает результат `buildSegmentNodes` и бросает `RoutingError`.
3. **Статика.** Dev-сервер отдаёт jar, patch-jar, профили, тайлы и пустой `storageconfig.txt`, и отдаёт их с Range. Поддерживает ли Range `devServer` из `webpack/webpack.config.js`, не проверено: проверить запросом `curl -r 0-0` до того, как писать свой middleware.
4. **Доступность.** Аналог `isServerReachable`, который в режиме `'browser'` означает «движок инициализирован». Кнопка `.routing-toggle` краснеет так же, как сейчас.
5. **Проверка.** Готово, когда выполнено всё:
   - в тестовом районе из `AGENTS.md` каждая из 6 активностей прокладывает отрезок;
   - опорный маршрут даёт 2083 м для `hiking` и 3830 м для `hiking-trails`;
   - undo/redo и сохранение разметки работают как с сервером;
   - `NODE_ENV=production npx eslint <изменённые файлы>` чистый.
