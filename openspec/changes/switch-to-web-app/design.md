# Design

## Context

Зачем — [proposal](proposal.md), поведение — спеки change. План перехода и что удаляется — [ресёрч, п. 5–7](../../research/new-ui.md#последствия-удаления); решения владельца — архивы [record-ui-decisions](../archive/2026-10-08-record-ui-decisions/design.md) и [record-new-ui-decisions](../archive/2026-10-08-record-new-ui-decisions/design.md) («Переключение без новой подложки», «Сессии: только автосохранение», «Тени рельефа из AWS Terrain Tiles, тайлы высот выводятся»). Сборка нового приложения на `/next/` — [add-web-skeleton](../archive/2026-10-08-add-web-skeleton/design.md#сборка-base-next-outdir-buildnext), ключи и базы нового приложения — [add-web-autosave](../archive/2026-10-09-add-web-autosave/design.md#автосохранение-структура-в-indexeddb-а-не-строка-nktk-агент), ключ Google — [add-web-search-panoramas](../archive/2026-10-09-add-web-search-panoramas/design.md#maps-javascript-api-и-ключ).

Что выяснилось при чтении кода (`master` `015be89`, 2026-10-09):

- В `web/` `/next/` зашит в четырёх местах: `base` и `outDir` в `vite.config.ts`, `BASE_URL` в `playwright.config.ts`, проверка путей скриптов в e2e «Открыть новое приложение», `pathname` в двух unit-тестах. Сам код от пути страницы не зависит: ссылка «Copy link» берёт `origin + pathname`, движок — пути от корня origin.
- Файлы движка (`brouter-wasm/lib`, `brouter-wasm/profiles`) в `build/` кладёт `CopyWebpackPlugin` старого клиента из `experiments/wasm/cheerpj/` (`noErrorOnMissing`); Vite этого не делает. Без webpack файлы движка в сборку не попадут, а деплой упадёт на проверке «check engine files are in the build».
- `public/` старого клиента: `favicon.ico` (у нового приложения favicon нет — браузер запрашивает `/favicon.ico` и получает от Pages `index.html`) и `recover_tracks.html` (страница восстановления треков из `localStorage` формата nakarte.me до сессий).
- Сессия старого клиента — IndexedDB `sessions`, хранилище `sessionData` (`keyPath: sessionId`, индекс `mtime`), запись `{sessionId, mtime, data: {hash, tracks, trackNames, routeMarkup}}`: `tracks` — строки `nktk` через `/` (`serializeTracks`), `routeMarkup` — `{legs: [[ключ начала, ключ конца, activityId], …]}`, ключ — `round(lat·arcUnit),round(lng·arcUnit)`, та же сетка, что у `nktk` ([leaflet.control.sessions](https://github.com/sergeycw/nakarte/blob/015be893/src/lib/leaflet.control.sessions/index.js), [session-state](https://github.com/sergeycw/nakarte/blob/015be893/src/lib/session-state/index.js), `serializeRouteMarkup`/`applyRouteMarkup` в [track-list.js](https://github.com/sergeycw/nakarte/blob/015be893/src/lib/leaflet.control.track-list/track-list.js)). Сессия привязана к вкладке через `history.state.sessionId`: новая вкладка старого клиента треков не восстанавливала, прежние сессии открывались только из меню «Recent sessions» (до 100 записей). Идентификаторы активностей старого и нового совпадают (`hiking`, `hiking-trails`, `road-bike`, `gravel`, `mtb`, `touring-bike`).
- Подсказка недоступного серверного BRouter нового приложения — `start it with yarn local` (`routerDownHint` в `web/src/routing/router.ts`); после удаления корневого `package.json` старого клиента такой команды нет.
- `scripts/check-no-author-hosts.mjs` пропускает четыре строки-метаданных старого бандла (`<title>nakarte.me</title>`, `creator` GPX, префикс имени JNX, текст уведомления сессий); в бандле нового приложения ни одной из них нет, разбор ссылок nakarte.me — экранированные регулярные выражения (`nakarte\.me`).
- Линт: `.eslintrc.js` с правилами `eslint_rules/` и prettier проверяет весь репозиторий, `main.yml` гоняет его вместе со stylelint (только CSS старого клиента: `web/` исключён). Biome 2.5.15 с правилами `recommended` на `workers/**/*.js`, `functions/**/*.js` и `scripts/*.mjs` (проба 2026-10-09): одно предупреждение линта (`noUnusedFunctionParameters`) и расхождения форматирования в 10 файлах (кавычки ключей объектов, перенос цепочек вызовов).

## Goals / Non-Goals

**Goals:**
- На `/` — новое приложение, старые ссылки и `/next/` работают; прод проверяется синтетикой.
- В репозитории нет старого клиента и всего, что жило только ради него: webpack, karma, eslint/prettier/stylelint, `src/secrets.js`, yarn, их workflow и правила в документах.
- Треки последней сессии старого клиента не пропадают с переключением.
- Документы (`AGENTS.md`, `docs/architecture/`, спеки) описывают одно приложение.

**Non-Goals:**
- Тайлы высот, маршрут прокси `/wikimapia/` и порты старых dev-серверов в `ALLOWED_ORIGINS` — следующий change `retire-old-client-services` (см. «Разрез»).
- Новая подложка — change 10; полировка вида — change 11.
- Переписывание слов «новое приложение» во всех требованиях спек: после переключения это просто приложение; требования меняются, только где поведение или проверка завязаны на `/next/` или старый клиент.

## Decisions

Решения, которых нет в ресёрче, архивах и задаче change, помечены **[агент]**: владелец попросил не останавливаться на вопросах.

### Разрез: два change **[агент]**

1. `switch-to-web-app` (этот) — переключение, удаление старого клиента, линт, CI, документы. Выкатывается одним деплоем Pages; Worker'ы и R2 не трогает.
2. `retire-old-client-services` — то, что в Worker'ах осталось без потребителя после удаления старого клиента: маршрут `/tiles/` Worker'а высот с генератором архива (`elevation-tiles`, workflow `elevation tiles`, `scripts/elevation-tiles.sh`), спека `elevation-tiles` и требование «Свои тайлы высот», маршрут прокси `/wikimapia/`, порты 8765, 8766 и 9876 в `ALLOWED_ORIGINS`. Выкатывается деплоем Worker'ов.

Почему не одним: другие цели деплоя (Pages против Worker'ов) и другой откат; вывод тайлов высот безопасен только когда на проде уже нет их потребителя — после деплоя этого change и проверки, что приложение на `/` их не запрашивает. Удаление архива `tiles/elevation-z0-9` в R2 необратимо — только с явного «да» владельца, иначе шаг владельца в design второго change.

### Сборка в `build/` с базой `/`

`vite.config.ts`: `base: '/'`, `outDir: '../build'`, `emptyOutDir: true`. Стенд — `build/engine-bench.html` (вход `bench` остаётся). Dev-сервер и `vite preview` открываются на `/`.

Файлы движка копирует плагин `engineFiles()` (`web/vite/engine-files.ts`) в хуке `writeBundle`: `experiments/wasm/cheerpj/lib` и `profiles` → `<outDir>/brouter-wasm/lib` и `profiles`, раскладка та же, что у его middleware и у webpack. Без каталогов (`build.sh` не запускался) — предупреждение в консоли сборки, сборка не падает: `check-web.yml` собирает без движка, а деплой проверяет файлы отдельным шагом, как сейчас **[агент]**. Альтернатива — `cp` шагом деплоя — отвергнута: ручная сборка по `AGENTS.md` и `vite preview` разошлись бы с деплоем.

`public/favicon.ico` переезжает в `web/public/`; `recover_tracks.html` удаляется вместе со старым клиентом **[агент]**: он читает формат `localStorage` nakarte.me, которого у клона не было.

### `/next/` — редирект Pages с сохранением `#`

`web/public/_redirects` (Vite копирует `public/` в корень сборки):

```
/next / 302
/next/* /:splat 302
```

`/next/#m=…` → `/#m=…`, `/next/engine-bench.html` → `/engine-bench.html`. Фрагмент на сервер не уходит; браузер переносит его через редирект, если в `Location` своего фрагмента нет ([RFC 9110, 10.2.2](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.2)); правила `_redirects` фрагменты источника не разбирают ([Pages, Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)). Код `302`, а не `301` **[агент]**: `301` браузер кеширует навсегда, и `/next/` нельзя было бы снова занять (например, под следующую большую переделку); поисковой выдачи у клона нет, выигрыша от `301` никакого. Проверки: unit-тест правил файла, e2e — браузер на `/next/#…` с ответом по этим правилам (`route.fulfill` с `302`) оказывается на `/#…`, `wrangler pages dev build` локально, на проде — Playwright и `prod-check.sh`.

### Сессия старого клиента: последняя, один раз **[агент]**

Подхватываем, а не бросаем: после переключения меню «Recent sessions» нет, и треки сессий иначе недоступны совсем. Только последнюю по `mtime` и только если у приложения нет своей записи автосохранения (`load()` вернул `undefined`):

- Своя запись есть — пользователь уже работал в новом приложении (`/next/`) или подхват уже был; второй раз не подхватываем, своих треков не трогаем. Флаг в `localStorage` не нужен: после подхвата автосохранение пишет запись, и условие больше не выполняется.
- Все сессии (до 100) — это свалка в списке; последняя — та, в которой пользователь работал перед переключением. Остальные остаются в базе `sessions`: база не меняется и не удаляется, к ним можно вернуться отдельным change, если владелец попросит.
- Чтение — `indexedDB.open('sessions')` без версии; если базы нет, `upgradeneeded` отменяет свою транзакцию, и база не создаётся. Ошибка, нет базы, пустая — подхвата нет, приложение стартует с пустым списком, предупреждение в консоли.
- Треки — `parseNktkSequence(data.tracks)` нового приложения; разметка — `legs` старого переводятся в `SegmentRoute` по ключам сетки, как `applyRouteMarkupToLine`: для каждого отрезка ищется пара точек с ключами концов ноги и хотя бы одной точкой между ними, точки внутри ноги — точки маршрута, остальные — опорные; нога неизвестной активности или без пары — прямая. Отрезок без найденных ног — без разметки. Дальше — общий путь импорта (`prepareImport` с `simplifyRouted`), как у ссылки.
- Модуль `web/src/autosave/legacy-session.ts` (чтение базы и перевод разметки — отдельные функции), `startAutosave` получает необязательный источник `legacy`, `App` — проп `legacySession` (по умолчанию — база `sessions`, в browser-тестах — `null` или заглушка).

### Линт `workers/` и `functions/`: Biome только линтером **[агент]**

Корневой `biome.json`: `files.includes` — `workers/**/*.js`, `functions/**/*.js`, `scripts/**/*.mjs` (без `node_modules` и `web/`, у которого свой `biome.json`), правила `recommended`, форматтер выключен. Почему без форматтера: прежний prettier через eslint проверял формат, но включить формат Biome — значит переформатировать 10 файлов, которые этот change не меняет (правило владельца: форматировать только редактируемые файлы); проверку формата можно включить отдельным change вместе с переформатированием. Корневой `package.json` — `private`, `type: module`, только `@biomejs/biome` 2.5.15 (та же версия, что в `web/`) и скрипт `lint`; lock-файл npm, `yarn.lock` удаляется. Workflow `check-lint.yml` — на PR и push в `master` с `paths` этих каталогов, `biome.json` и корневых `package*.json`. `scripts/*.mjs` eslint не проверял (`--ext js`) — теперь проверяются. Правила `import/*` eslint (неразрешённые импорты, лишние зависимости) в Biome без аналога; импорты Worker'ов и функций проверяют их тесты в `workerd`.

### CI и деплой

- `deploy-pages.yml`, job `pages`: убираются `cp src/secrets.js.template`, шаг `google maps key` (`sed`), `yarnpkg`, `npm run build` с `NAKARTE_TARGET`; порядок: тесты Pages Functions → `build.sh` движка → `npm ci` и Chromium в `web/` → `npm test` → `npm run build` с `VITE_GOOGLE_MAPS_API_KEY` → проверка файлов движка в `build/` → `npm run e2e` → проверка адресов автора по `build/` → `wrangler pages deploy build`. Фильтр job'а `changes`: из исключений уходит `test/`.
- `check-web.yml`: проверка адресов автора — `../build`. `main.yml` и `check-clone.yml` удаляются: сборку клона и адреса автора на PR проверяет `check web`.
- `scripts/check-no-author-hosts.mjs`: список строк-метаданных пустеет и удаляется — любое буквальное вхождение `nakarte.me` в бандле ошибка.
- `scripts/prod-check.sh`: `site` — `200` и `<title>nakarte routing</title>` на `/`; `site next` — `/next/` без следования отвечает `3xx` с `Location: /`. Остальные строки — без изменений (тайлы высот уходят во втором change).

### Подсказка серверного BRouter

`BRouter is not running, start it with docker compose up -d` — команда из корня репозитория поднимает `docker-compose.yml` с BRouter на 17777, как поднимал `yarn local`.

### Ссылки на удалённые файлы

Ресёрчи (`openspec/research/*.md`) и backlog ссылаются на файлы `src/` и `test/` как на справочник старого клиента. Такие ссылки переводятся на постоянные ссылки GitHub на последний коммит `master` со старым клиентом (`https://github.com/sergeycw/nakarte/blob/015be893/src/…`) **[агент]**: справочник остаётся читаемым, ссылки не битые. Архивы changes не правятся: их ссылки на `src/` ведут в историю, проверка ссылок их пропускает.

### Документы

- `AGENTS.md` — переписывается под одно приложение: карта репозитория без `src/`, `test/`, `webpack/`; «Запуск» — `web/` и `docker compose`; разделы «Где код роутинга» и «Проверка в браузере» про Leaflet удаляются, подвохи нового приложения остаются; «Свои бэкенды» — без правила «апстримный `main.yml` не трогаем»; ручная сборка клона — без webpack.
- `docs/architecture/client.md` и `route-editor.md` — заново по коду `web/` и design changes 1–8; `README.md` (диаграммы контейнеров и связей), `ci-cd.md`, `decisions.md` (строка «старый клиент удалён, приложение на `/`»), остальные — точечно.
- `openspec/config.yaml`: контекст без старого клиента, правило задач без karma.
- `../.claude/launch.json` (вне репозитория): записи `nakarte` и `nakarte-wasm` (webpack на 8765/8766) удаляются, `nakarte-web` открывается на `/`.
- Purpose спеки `web-client` правится в основной спеке при archive: «растёт рядом со старым клиентом» больше не верно.

### Тесты

- **Unit (Node):** правила `_redirects` (`/next`, `/next/`, `/next/engine-bench.html`); перевод разметки старой сессии в `SegmentRoute` (нога найдена, неизвестная активность, ключи без пары, две ноги подряд, точка между ними опорная); `startAutosave` с источником `legacy` (подхват без своей записи, своя запись есть, источник упал); `routerDownHint`; `engine-files` — копия каталогов в сборку и предупреждение без них.
- **Browser mode:** чтение настоящей IndexedDB `sessions` в Chromium (последняя по `mtime`, базы нет — не создаётся), сценарий «Сессия старого клиента» в `App`.
- **e2e (vite preview на `/`):** «Открыть приложение» (скрипты от корня), «Стенд движка», «Ссылка на /next/ с параметрами» и «Стенд по старому адресу» (ответ `/next/…` по правилам `_redirects` через `route.fulfill`), «Набор реальных старых ссылок» (`src/state/fixtures/old-links.txt` и синтетические с `j=`, `min=`, `sid=`: без `pageerror`, вид из `m=`), сценарии спеки `tracks` про сессию старого клиента — запись в базу `sessions` до загрузки.
- Сеть: фикстура `network` (`auto: true`) остаётся, ни один тест в сеть не ходит.

## Risks / Trade-offs

- [Пользователь старого клиента открывает `/` и видит другой интерфейс] → решение владельца; функции перенесены, ссылки читаются, последняя сессия подхвачена.
- [Подхвачена только последняя сессия] → остальные в базе `sessions` не тронуты; вернуть их список — отдельный change по просьбе.
- [Пользователь уже открывал `/next/` и что-то там сохранил — его сессия старого клиента не подхватится] → его рабочий набор — список нового приложения; это тот же владелец и пара тестовых заходов.
- [Biome без проверки формата] → линт сохраняется; формат — отдельный change с переформатированием.
- [Ссылки в архивах на `src/` битые] → архивы не правятся по правилу; постоянные ссылки — в живых документах.
- [`302` вместо `301` для `/next/`] → лишний запрос на каждую старую ссылку `/next/`, таких ссылок единицы.
- [Откат] → revert и push: деплой соберёт прежнее состояние с обоими клиентами; базы и ключи `localStorage` не меняются.

## Migration Plan

1. PR в `master`: `check web`, `check lint` и проверки Worker'ов зелёные; ревью диффа субагентом.
2. Merge → `deploy pages` выкатывает всё (менялся сам workflow), `smoke` проверяет `/` и `/next/`.
3. На проде: `/` — приложение, старые ссылки (набор фикстуры), `/next/#…` → `/#…`, `/engine-bench.html`, движок на `/`, подхват сессии старого клиента (заранее сохранить сессию нельзя — старого клиента на проде уже нет; проверка — e2e и browser-тест), скриншоты компьютера и Pixel 7. Итог — в «Проверки», архив — вторым PR.
4. Следом — change `retire-old-client-services`.

## Проверки
