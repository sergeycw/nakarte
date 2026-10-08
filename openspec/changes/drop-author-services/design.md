# Design

## Context

Мотивация — в `proposal.md`. Первая версия этого change (до смены курса 2026-10-08) предлагала завести ключ mapy.cz и маршрут `/mapy/` в своём прокси, а свои адреса держать только в `src/config-target/clone.js`. Курс сменился: апстрим — справочник, неиспользуемый код удаляется, дифф с апстримом не бережём.

Где сейчас адреса автора:

| Где | Что | Кто ходит |
|---|---|---|
| `src/config.js` | `CORSProxyUrl`, `wikimapiaTilesBaseUrl` (`proxy.nakarte.me`), `tracksStorageServer`, `elevationsServer`, `elevationTileUrl`, `eventsLogUrl` (`nakarte.me/event`), `caption` (docs, news, почта, donate) | сборка без цели; клон перебивает всё, кроме `caption` |
| `src/layers.js` | `Czt`, `Czw` через `https://proxy.nakarte.me/mapy/…` | обе сборки |
| `src/secrets.js.template` | `sentryDSN` — заглушка на `sentry.io`, `mapyCz` — нигде не читается | сборка без цели инициализирует Sentry с заглушкой |

Строки `nakarte.me`, которые не являются запросами и остаются: `<title>nakarte.me</title>` в `src/index.html`, `creator="http://nakarte.me"` в GPX (`geo_file_exporters.js`), префикс имени файла JNX `nakarte.me_` (`leaflet.control.jnx`), текст уведомления «Switch nakarte.me window» (`leaflet.control.sessions`). Разбор ссылок `nakarte.me` в поиске и импорте треков — регулярные выражения, в бандле они экранированы (`nakarte\.me`) и запросов к автору не делают: трек по `nktl=` берётся из `config.tracksStorageServer`.

## Goals / Non-Goals

**Goals:**
- Ни одного сетевого запроса к `*.nakarte.me` ни из клона, ни из сборки без цели.
- Свои сервисы — значения по умолчанию; `clone.js` описывает только отличия клона от локального серверного режима.
- Проверка, которая ловит адрес автора в бандле до деплоя.

**Non-Goals:**
- Переименование продукта (`<title>`, GPX `creator`, имя JNX).
- Слой mapy.cz со своим ключом — пункт бэклога.
- Починка поиска mapy.cz, если он не работает через свой прокси, — пункт бэклога.

## Decisions

### Слои mapy.cz удаляются

Ключа mapy.cz у владельца нет, у автора слои помечены «Out of order», панорамы mapy.cz уже удалены (`remove-panorama-providers`). Слои `Czt` и `Czw` удаляются из `layersDefs`, `groupsDefs` и `titlesByOrder`; хоткей `H` у `Czt` освобождается. Маршрут `/mapy/` в прокси не делается, дельта `cors-proxy` про него убрана. Старые коды `Czt`, `Czw` в адресе и настройках контрол слоёв игнорирует (требование «Старые коды удалённых слоёв»). Поиск mapy.cz (`providers/mapycz`, запросы через `urlViaCorsProxy`) и ссылка на mapy.cz во внешних картах остаются.

### Свои сервисы по умолчанию

`src/config.js` получает адреса своих Worker'ов и атрибуцию высот viewfinderpanoramas (данные одни для всех сборок). `eventsLogUrl` и `sentryDSN` пустые: своего сбора событий и Sentry нет. В `clone.js` остаются `routingEngine: 'browser'` и `routingTilesPath: '/tiles/'` — единственное, чем публичный клон отличается от локального режима с BRouter на сервере.

`secrets.js` разворачивается в `config` после значений по умолчанию, поэтому заглушка `sentryDSN` из шаблона перебила бы пустое значение. Заглушки `sentryDSN` и `mapyCz` удаляются из `src/secrets.js.template`, а `Sentry.init` в `src/index.js` вызывается только при непустом DSN: так Sentry молчит и со старым локальным `secrets.js`. Модуль Sentry остаётся в бандле: `logging` зовёт `captureException` и `addBreadcrumb`, без инициализации они ничего не отправляют.

### Подпись карты

`caption` — `nakarte routing` и ссылка на репозиторий форка `https://github.com/sergeycw/nakarte`. Донатов и почты нет.

### Origin karma в прокси

Тесты `test_track_load.js` (апстримные, ходят в живые сервисы) берут прокси из `config.CORSProxyUrl`. Раньше в CI это был `proxy.nakarte.me`; со своим прокси по умолчанию запросы приходят с `Origin: http://localhost:9876` (порт karma из `test/karma.conf.js`), а `ALLOWED_ORIGINS` его не пускает. Варианты: подменять прокси для тестов или добавить origin karma в список. Выбран второй: тесты проверяют настоящий путь клиента через свой прокси, а не чужой сервис; `Origin` и так подделывается любым `curl` (CORS от злоупотреблений не защищает, это задача `[[ratelimits]]`), поэтому ещё один localhost-origin, как уже разрешённые 8765 и 8766, риска не добавляет.

Порядок выкатки: PR-тесты karma ходят в задеплоенный прокси, а он обновляется только после merge в `master`. Поэтому change идёт двумя PR: сначала артефакты и origin karma в `workers/cors-proxy/wrangler.toml` (merge → деплой прокси), потом клиент.

### Статическая проверка бандла

`scripts/check-no-author-hosts.mjs <каталог>` обходит текстовые файлы сборки (`.js`, `.html`, `.css`, `.json`, `.txt`, `.webmanifest`, `.svg`; без `.map` — карты исходников браузер не запрашивает, а в них комментарии исходников), ищет буквальное `nakarte.me` с поддоменами и печатает каждое вхождение с контекстом. Разрешены только известные метаданные из «Context» — по контексту строки, а не по файлу: `<title>nakarte.me</title>`, `creator="http://nakarte.me"`, `nakarte.me_` (имя JNX), `Switch nakarte.me window` и `switch nakarte.me window`. Регулярные выражения разбора ссылок (`nakarte\.me`) под поиск не попадают. Код выхода 1 при находке. Шаг в `deploy-pages.yml` идёт сразу после сборки и до публикации. Проверка скрипта: на бандле до правок он падает и называет адреса, после — проходит.

### Тесты Strava и Garmin Connect

Через свой прокси `test_track_load.js` стабильно падает на Strava и Garmin Connect, и прокси тут ни при чём (проверено 2026-10-08 curl'ом, node fetch и через оба прокси):

- Strava: `activities/<id>/streams` без входа отвечает `301` на `/login`, `401` или `403`. У `proxy.nakarte.me` тестовые активности проходят только из его кеша (`X-Proxy-Cache: HIT`); тот же адрес с лишним параметром (`MISS`) получает `403` и там.
- Garmin Connect за Cloudflare bot management: `403` на curl, node fetch и Worker с любым `User-Agent`; у автора проходит только с его сервера.

Тесты убраны вместе с фикстурами, как раньше wikiloc; код импорта не тронут, поломка записана в бэклог.

### Strava heatmap и Wikimapia через свой прокси

Сквозная проверка нашла два слоя, которые и до этого change не работали в клоне со своим прокси:

- Wikimapia: nginx `wikimapia.org` отвечает `403` на запрос без `User-Agent`, а `fetch` из Worker'а его не ставит. Прокси теперь пересылает `User-Agent` клиента (спека «Фильтрация заголовков»).
- Strava heatmap (`Sa`, `Sr`, `Sb`, `Sw`): CloudFront отдаёт тайлы `content-a.strava.com/identified/globalheat/` только с подписанными куками `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` вошедшего аккаунта Strava, иначе `403 MissingKey` (напрямую тоже). На nakarte.me слои работают, потому что `proxy.nakarte.me` подставляет такие куки сам: некешированный тайл через него — `200` (`X-Proxy-Cache: MISS`). Код его прокси не опубликован. Делаем так же: секрет Worker'а `STRAVA_COOKIES` уходит заголовком `Cookie` только на тайлы heatmap.

Третья находка — в `test_search_links.js`: короткие ссылки mapy.com (`/s/<id>`) клиент раскрывает запросом `HEAD`, а mapy.com на `HEAD` отвечает `404`, на `GET` — `301` с координатами. Авторский прокси на nginx превращает `HEAD` в `GET` (поведение кеша nginx), поэтому у автора ссылки работали. Наш прокси делает так же и отдаёт клиенту статус и заголовки без тела (спека «HEAD как GET»).

Четвёртая — короткие ссылки `goo.gl/maps`: Google отправляет запросы с IP Cloudflare Workers на капчу `www.google.com/sorry/` (`429`), авторский прокси получает обычную цепочку через consent. Капчу не проходим; исходный адрес с координатами Google кладёт в параметр `continue`, и разбор ссылок в `leaflet.control.search/providers/links.js` берёт его оттуда.

Правки прокси (User-Agent, куки Strava, `HEAD`) ушли отдельным PR раньше клиента — по той же причине, что origin karma.

Секрет заводит владелец (агент токены и сессии не вводит), до этого слои Strava остаются пустыми. Шаги: войти на strava.com, открыть Global Heatmap, в DevTools → Application → Cookies взять значения `CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature` и выполнить из `workers/cors-proxy` `npx wrangler@4 secret put STRAVA_COOKIES` со строкой `CloudFront-Key-Pair-Id=…; CloudFront-Policy=…; CloudFront-Signature=…`; деплой не нужен. Откуда сейчас берутся эти куки и сколько живут, не проверено: по старым источникам ([stravacookies](https://pypi.org/project/stravacookies/1.2/), [OSM forum](https://community.openstreetmap.org/t/new-strava-heatmap-extension-for-id/100544?page=2)) их ставит страница heatmap вошедшему пользователю, срок — около недели, поэтому секрет придётся обновлять; автоматическое обновление — пункт бэклога. В проверке 2026-10-08 залогиненная сессия владельца в Chrome сама получила `403` на прямой запрос тайла, так что способ получения кук может отличаться.

## Risks / Trade-offs

- [Куки Strava протухают, слои heatmap пустеют] → обновить секрет; автоматизация — бэклог.
- [Раздача тайлов heatmap всем через куки одного аккаунта — серая зона условий Strava] → так же делает nakarte.me; решение за владельцем, без секрета прокси кук не шлёт.

- [Внешние сервисы режут запросы с IP Cloudflare, и `test_track_load.js` падает уже из-за своего прокси] → прогнать файл локально через задеплоенный прокси до PR клиента; флапы `NETWORK` перезапускать, стабильные падения из-за прокси чинить.
- [Пользователи сборки без цели теряют слои mapy.cz и подпись автора] → решение владельца, сборка без цели — локальный режим того же продукта.
- [Правка автора вернёт адрес `nakarte.me` при переносе] → статическая проверка в деплое.

## Migration Plan

PR 1 (артефакты, origin karma) → merge → деплой прокси. PR 2 (клиент, скрипт, документы) → merge → автодеплой, скрипт проверяет бандл. Откат — revert PR.
