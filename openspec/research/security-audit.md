# Security-аудит клона

Ресёрч 2026-10-08 по пункту «Security-аудит клона» из [backlog](../backlog.md), раздел «Глобальное направление». Главный вопрос — что бьёт по деньгам на Workers Paid и R2, потом всё остальное. Документ — вход для changes из [итоговой таблицы](#итог); когда его changes сделаны, документ удаляется (`AGENTS.md`, «Где что записано»), причины решений уходят в архив changes.

Архитектура границы защиты здесь не пересказывается: [аудит системного дизайна](system-design-audit.md), п. 5 «CORS и граница защиты» и п. 7 «Стоимость», схема — [protection.md](../../docs/architecture/protection.md). Каждое утверждение о текущей защите сверено с кодом, `wrangler.toml` и workflow на `master` (`cdb3082`), с Cloudflare API и GraphQL Analytics (только чтение) и единичными запросами на чтение к проду; [расхождения](#расхождения-кода-и-документации) — отдельный раздел.

## Коротко

- Самое дорогое — API высот на точках вразброс: до ≈ 10 000 чтений R2 класса B на вызов, при лимите 60 вызовов в минуту это ≈ **$9 800 в месяц с одного IP**. Аудит системного дизайна оценивал вызов в ≈ 2 000 чтений; верхняя граница — потолок платформы в 10 000 подзапросов, а не код.
- Любую новую защиту Worker'ов можно обойти через **Version URL** старой версии (`<версия>-nakarte-elevation.nakarte-routing.workers.dev` отвечает `200`), а Pages Functions — через любой из **77 старых деплоев** (`<хеш>.nakarte-routing.pages.dev` отдаёт тайл с `206`). Нигде не записано.
- Pages Functions (`/tiles/`, `/brouter-wasm/`) без ограничения частоты: одна машина на 1 000 запросов в секунду — ≈ $1 700 в месяц. Привязку rate limiting Pages Functions не поддерживают.
- Хранилище треков: 60 записей по 10 МиБ в минуту с одного IP — ≈ 27 ТБ и **+$408 в месяц за каждый месяц атаки**, и хранение копится, пока объекты не удалят.
- `CLOUDFLARE_API_TOKEN` лежит в окружении всего job'а деплоя: его видят `yarnpkg` (1 183 пакета клиента, 315 известных уязвимостей в dev-зависимостях), `npm ci`, сборочные скрипты `cargo` и сторонний `Swatinem/rust-cache`. Утечка — деплой любого кода и удаление бакетов, в том числе невосстановимых треков.
- Прокси по деньгам дешёв (≈ $48 в месяц с IP), но это открытый HTTP-релей с IP Cloudflare и с заголовком `CF-Worker` нашего поддомена: риск — жалобы и блокировка аккаунта, а не счёт.
- Жёсткого потолка расходов у Cloudflare нет: бюджетные оповещения только пишут письмо раз в сутки. Единственные «тормоза» — `[limits]` на вызов и свои счётчики частоты.

Исправлено 2026-10-08 шестью changes (P1, [итог](#итог)): Version URL выключены, токен только у шагов `wrangler`, лимиты чтений высот и записей треков, прокси по ролям, лимит частоты Pages Functions с удалением старых деплоев. Осталось — P2–P3 и [шаги владельца](#шаги-владельца).

## Цены и как считаем

Первоисточники, 2026-10-08:

- [Workers](https://developers.cloudflare.com/workers/platform/pricing/): запросы $0.30 за миллион сверх 10 млн, CPU $0.02 за миллион мс сверх 30 млн; подзапросы не тарифицируются; вызовы по service binding не тарифицируются как отдельный запрос (платится CPU обоих). «Only requests that hit a Worker will count against your limits and your bill».
- [Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/) тарифицируются как Workers, статика бесплатна и без лимита.
- [R2](https://developers.cloudflare.com/r2/pricing/): хранение $0.015 за ГБ-месяц, класс A $4.50 и класс B $0.36 за миллион, бесплатно 10 ГБ, 1 млн A, 10 млн B. Тарифицируется ли `GetObject` на отсутствующий ключ — в документации не сказано.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/): 20 млн событий включено, дальше $0.60 за миллион; событие — вызов плюс каждый `console.log`, умножается на `head_sampling_rate`. С 2026-12-01 — [Cloudflare Observability](https://developers.cloudflare.com/observability/pricing/) (по объёму: 50 ГБ приёма включено, дальше $0.25 за ГБ).
- [Лимиты](https://developers.cloudflare.com/workers/platform/limits/#subrequests): на Paid по умолчанию 10 000 подзапросов на вызов, обращения к R2 через привязку — тоже подзапросы; одновременно ждут заголовков не больше 6 соединений.

Худший сценарий считается на один IP при текущем лимите частоты: `лимит в минуту × 43 200 минут в месяц × цена вызова`. Бесплатные объёмы не вычитаются: под атакой они кончаются в первые часы. Распределённый клиент умножает сумму на число IP: счётчики [локальны для каждой локации Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) и защищают только от одного клиента (это признают спека [worker-limits](../specs/worker-limits/spec.md) и design [add-worker-limits](../changes/archive/2026-10-07-add-worker-limits/design.md), «Non-Goals»).

Использование за 30 дней до 2026-10-08 (GraphQL Analytics): прокси 19 430 запросов, высоты 308, треки 31, Pages Functions 1 721; R2 класс B ≈ 63 тыс. (почти всё — генерация архива высот), класс A ≈ 28 тыс. (заливка). Объём: `nakarte-elevation` 16.9 ГБ, `nakarte-tiles` 10.0 ГБ, `nakarte-tracks` 3 объекта. Реальных злоупотреблений не видно; ниже — что будет, если они начнутся.

## 1. Флуд Worker'ов и Pages Functions

**Угроза.** Скрипт подделывает `Origin` (его проверка ничего не стоит обойти) и шлёт запросы с одного или многих IP: оплачиваются запросы, CPU и события логов.

| Точка входа | Цена вызова | Лимит сейчас | Худший случай с одного IP |
|---|---|---|---|
| Прокси, тайл | $0.30 + ≈ 1 мс CPU $0.02 + событие лога $0.60 ≈ $0.92 за миллион | 1 200 в минуту | 51.8 млн × $0.92 ≈ **$48** |
| Тайлы высот z10–11 | запрос + до 8 чтений B + ≈ 5–10 мс CPU + лог ≈ $2.4–4 за миллион | 600 в минуту | 25.9 млн → **$63–103** |
| API высот | см. [п. 2](#2-чтения-r2-класса-b) | 60 в минуту | **≈ $9 800** |
| Треки | см. [п. 3](#3-спам-записей-в-nakarte-tracks) | 60 в минуту | **+$408 за месяц атаки** |
| Pages Functions `/tiles/` | $0.30 + чтение B $0.36 ≈ $0.66 за миллион | **нет** | 100 запросов/с — ≈ $170; 1 000/с — ≈ $1 700 |
| Pages Functions `/brouter-wasm/` | $0.30 + CPU на чтение ассета целиком (`brouter.jar` 2.3 МБ) | **нет** | того же порядка, что `/tiles/` |

**Как защищено сейчас** (сверено по коду): `[limits]` и `[[ratelimits]]` в `wrangler.toml` трёх Worker'ов, проверка в `fetch` после `Origin` ([protection.md](../../docs/architecture/protection.md)). У Pages Functions нет ничего: привязки rate limiting в [списке привязок Pages](https://developers.cloudflare.com/pages/functions/bindings/) нет. Защита от DDoS [бесплатна и без лимита](https://developers.cloudflare.com/ddos-protection/about/), но пороги срабатывания не опубликованы, а равномерный поток в сотни запросов в секунду атакой не выглядит.

**Обход лимитов, найденный при проверке.**

- *Version URL.* У всех трёх Worker'ов `previews_enabled: true` (Cloudflare API, `workers/scripts/*/subdomain`). [Version URL](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/) создаётся на каждую версию и открыт публично; `https://887323ef-nakarte-elevation.nakarte-routing.workers.dev/tiles/0/0/0` (версия 52 из 59) ответил `200`. Новый лимит в коде действует только в новой версии — старые остаются открыты со старым кодом. Выключается `preview_urls = false` в `wrangler.toml`: «Disabling Version URLs disables routing to Version URLs and aliased Version URLs».
- *Старые деплои Pages.* У проекта 77 деплоев, каждый доступен по `https://<хеш>.nakarte-routing.pages.dev` со своими функциями: `762b3e5f.nakarte-routing.pages.dev/tiles/E40_N40.rd5` ответил `206`. Лимит в новой функции обходится через старый деплой; закрывает только удаление старых деплоев (Pages API `DELETE …/deployments/{id}`).

**Варианты для Pages Functions.**

1. Service binding из функции в маленький Worker с привязкой `[[ratelimits]]`. Вызов по service binding [не тарифицируется как запрос](https://developers.cloudflare.com/workers/platform/pricing/#service-bindings), Pages Functions service bindings [поддерживают](https://developers.cloudflare.com/pages/functions/bindings/). Плюс удаление старых деплоев после каждого деплоя. Цена — день.
2. Pages → Worker со статикой ([аудит системного дизайна](system-design-audit.md), «Переделки», P3): rate limiting прямо в Worker'е, но Range у статики Worker'а не подтверждён. 1–2 дня.
3. Свой домен и правило rate limiting зоны ([п. 7](#7-что-даёт-cloudflare-сверх-нынешнего)): на Free одно правило, окно 10 с, по IP.

**Рекомендация.** Version URL выключить сразу (минуты, без этого остальные лимиты бессмысленны). Pages Functions — вариант 1 с лимитом 1 200 в минуту на IP на обе функции: маршрут — ≈ 40 Range-чтений, запуск движка — чтения jar и профилей; с одного IP это ≈ 51.8 млн × $0.66 ≈ **$35** в месяц вместо неограниченного. Workers Logs: `head_sampling_rate` у прокси оставить 1 — логи нужны для разбора кук Strava, а события логов удваивают цену запроса только под атакой (P3: понизить, если трафик вырастет).

## 2. Чтения R2 класса B

**API высот.** Код ([lib.rs](../../workers/elevation/core/src/lib.rs), `elevations`) читает заголовок каждого задетого градуса и каждый задетый кусок (четверть градуса). 10 000 точек вразброс по разным градусам — до 10 000 заголовков и 10 000 кусков. Платформа обрывает вызов на 10 000-м подзапросе (`subrequests` у `nakarte-elevation` не задан, значит действует [умолчание Paid](https://developers.cloudflare.com/workers/platform/limits/#subrequests)), так что верхняя граница — ≈ 10 000 чтений B на вызов, ≈ $0.0036, плюс CPU (3.8 с на 3 000 точек в замере [add-worker-limits](../changes/archive/2026-10-07-add-worker-limits/design.md), ≤ $0.0002). Кеш изолята (32 МБ) прячет заголовки после прогрева, но не куски: их ≈ 420 тыс., по 40–100 КБ.

- С одного IP: 60 × 43 200 = 2.59 млн вызовов × ≈ $0.0038 ≈ **$9 800 в месяц**.
- Законному клиенту столько не нужно. Профиль ([elevation-profile](../../src/lib/leaflet.control.elevation-profile/index.js)) шлёт до 9 999 точек вдоль трека, экспорт GPX с высотами ([track-list.js](../../src/lib/leaflet.control.track-list/track-list.js), `addElevations`) — точки трека пачками по 10 000. Точки вдоль трека задевают немного кусков: прямая на 500 км пересекает ≈ 40–50 кусков, на 5 000 км — ≈ 450, а градусов в разы меньше.

**Варианты.** (а) Потолок чтений на запрос: заголовки + куски ≤ 512, больше — `413`. Один вызов ≤ 512 чтений, но с IP всё равно 60 × 512 в минуту ≈ $480 в месяц. (б) Бюджет чтений на IP: второй счётчик `[[ratelimits]]`, который тратится пропорционально числу чтений запроса (один `limit()` на каждые 64 чтения), 2 048 чтений в минуту. Длинный профиль на 5 000 км (≈ 470 чтений) проходит с запасом. (в) Понизить лимит вызовов: снижает линейно и бьёт по экспорту больших треков. (г) Явный `subrequests` чуть выше потолка (а), чтобы ошибка в коде не вернула 10 000.

**Рекомендация.** (а) + (б) + (г): с одного IP ≤ 2 048 × 43 200 ≈ 88.5 млн чтений ≈ $32 плюс запросы и CPU — **≈ $34 в месяц**, в ≈ 300 раз меньше. Контракт «до 10 000 точек» сохраняется для точек вдоль трека; ответ на слишком разбросанный запрос — `413`, как на слишком большой. Цена — полдня.

**Тайлы высот z10–11** считаются на лету: до 4 кусков и 4 заголовков на тайл при промахе кеша. С IP — $63–103 в месяц (таблица в [п. 1](#1-флуд-workerов-и-pages-functions)). P2: общий бюджет чтений с API.

**Тайлы BRouter** — одно чтение B на Range-запрос, цена — в строке Pages Functions [п. 1](#1-флуд-workerов-и-pages-functions).

## 3. Спам записей в `nakarte-tracks`

**Угроза.** Ключ — md5 тела, его считает любой скрипт ([key.js](../../workers/tracks/src/key.js)), содержимое не проверяется. Запись неизменяемая и бессрочная: хранение копится, пока объект не удалят, а удалять сейчас нечем — у объектов нет даже времени записи ([аудит системного дизайна](system-design-audit.md), п. 3).

- Сейчас: 60 записей в минуту × 10 МиБ = 2.59 млн записей ≈ 27 200 ГБ в месяц с одного IP: хранение **+$408 в месяц за каждый месяц атаки** (через год атаки — ≈ $4 900 в месяц только за хранение) плюс класс A ≈ $11.7.
- Реальный размер: трек упрощается перед сохранением (`simplifyKeepingWaypoints`, допуск ≈ 2.4 м), точка в `nktk` — дельты в protobuf и base64url, порядка 3–4 байт. 10 МиБ — это миллионы точек; 2 МиБ — сотни тысяч, с запасом на ссылку на десяток больших треков.

**Рекомендация.** Отдельный счётчик записей — 10 в минуту на IP; потолок тела 2 МиБ; тело только из алфавита `nktk` (`A–Z a–z 0–9 - _ /`), иначе `400` — хранилище перестаёт быть файлообменником для произвольных байт; время записи в `customMetadata`, чтобы после атаки удалить объекты за окно по листингу. С одного IP: 432 тыс. записей × 2 МиБ ≈ 906 ГБ ≈ **+$13.6 в месяц** за месяц атаки, класс A в бесплатном объёме. Цена — полдня.

## 4. `nakarte-cors-proxy` как открытый прокси

**Как сейчас** ([index.js](../../workers/cors-proxy/src/index.js)): любой `http`/`https` хост, методы `GET`, `HEAD`, `POST` (тело пересылается), один лимит 1 200 в минуту на всё. `Origin` или `Referer` подделываются.

**Угрозы.**

- *Деньги* — ≈ $48 в месяц с IP ([п. 1](#1-флуд-workerов-и-pages-functions)), egress бесплатный.
- *Злоупотребление от нашего имени.* Прокси — анонимный HTTP-релей с IP Cloudflare: сканирование, перебор паролей через `POST`, обход блокировок. Каждый подзапрос несёт заголовок `CF-Worker` с нашим поддоменом, жалобы придут в Cloudflare на `nakarte-routing.workers.dev`. Худший исход — блокировка Worker'а или аккаунта, то есть всего клона.
- *Strava.* Тайлы heatmap уходят с куками сессии владельца (`STRAVA_SESSION`), только на `content-*.strava.com/identified/globalheat/` ([strava.js](../../workers/cors-proxy/src/strava.js), `isStravaHeatmap`; на другие адреса куки не уходят — проверено по коду и тестам). Но 1 200 тайлов в минуту с каждого IP атакующего — это выкачка heatmap от имени аккаунта владельца: риск блокировки аккаунта Strava.
- *SSRF.* Свои Worker'ы через прокси недоступны: запрос `/https/nakarte-elevation.nakarte-routing.workers.dev/…` получил `error code: 1042` ([Worker на тот же zone](https://developers.cloudflare.com/workers/observability/errors/)). Pages доступен: `/https/nakarte-routing.pages.dev/tiles/storageconfig.txt` — `200`, то есть прокси может гонять запросы в наши же функции. Частные адреса: `fetch()` по IP [не поддерживается](https://developers.cloudflare.com/workers/platform/known-issues/), внутренней сети у Worker'а нет.
- *Фишинг на нашем адресе.* Прокси отдаёт `text/html` целевого сайта, но браузер при переходе по ссылке не пошлёт разрешённый `Origin` или `Referer` — получит `403`. Риск низкий.

**Кто ходит через прокси** (сверено по `src/`): тайловые слои из [layers.js](../../src/layers.js) (Strava heatmap, swisstopo, Tsvetkov) и при печати — все слои с `noCors: true` ([rasterize](../../src/lib/leaflet.layer.rasterize/TileLayer.js)); свои слои пользователя всегда с `noCors: true` ([layers.configure](../../src/lib/leaflet.control.layers.configure/index.js)) — при печати через прокси идут **произвольные хосты**; импорт по ссылке (`simpleService` — любой URL) и сервисы импорта; поиск mapy.cz, Bing и раскрытие коротких ссылок (`HEAD` на любой хост). `POST` через прокси клиент не шлёт ни разу. Значит, чистый список разрешённых хостов сломает печать своих слоёв и импорт по ссылке.

**Рекомендация.** Прокси по ролям без правок клиента: (1) только `GET`, `HEAD`, `OPTIONS`, без тела; (2) свои адреса (`*.nakarte-routing.workers.dev`, `*.nakarte-routing.pages.dev`) — `403`; (3) хосты тайловых слоёв из `layers.js` — прежний лимит 1 200, все остальные (импорт, свои слои, короткие ссылки) — отдельный счётчик 300 в минуту. Забытый в списке хост слоя не ломается, а попадает под меньший лимит. Деньги это почти не меняет, но убирает `POST`-релей и в 4 раза урезает релей на произвольные хосты. Отдельный лимит на heatmap — P2, если Strava начнёт жаловаться. Цена — полдня. Это строка «Прокси по ролям» [таблицы переделок](system-design-audit.md#переделки).

## 5. Секреты и права

| Секрет | Где | Кто видит сейчас | Права | Утечка |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub, уровень репозитория | `env` всего job'а в `deploy-pages.yml` (все шаги четырёх job'ов: `yarnpkg`, `npm ci`, `npm test`, `cargo test`, `cargo install worker-build`, `Swatinem/rust-cache`); в `brouter-tiles-sync.yml` — только шаг синхронизации | по [ci-cd.md](../../docs/architecture/ci-cd.md): Pages Edit, Workers Scripts Edit, Workers R2 Storage Edit на весь аккаунт; агенту права токена не видны (API токенов — `9109 Unauthorized`) | деплой любого кода в любой Worker и Pages (фишинг на наших адресах, чтение `STRAVA_SESSION` своим кодом прокси), новый Worker с потолком CPU 5 минут, удаление бакетов — треки невосстановимы. Сумма не ограничена |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | GitHub | шаг заливки в ручных `elevation data` и `elevation tiles` | Object Read & Write только на `nakarte-elevation` | порча данных высот (пересборка ≈ 40 + 60 минут workflow), запись мусора: класс A $4.50 за миллион и хранение без потолка |
| `STRAVA_SESSION`, `STRAVA_COOKIES` | секреты Worker'а прокси | код прокси; любой, кто может задеплоить прокси | сессия аккаунта Strava владельца целиком | доступ к аккаунту владельца: активности, приватные данные, настройки |
| `GOOGLE_MAPS_API_KEY` | GitHub, **не заведён** (`gh secret list`) | — | — | если завести, ключ публичен в бандле по замыслу: защищают ограничения по referrer и API и квота в Google Cloud |

Workflow с записью в Cloudflare и R2 — `deploy pages`, `brouter tiles sync`, `elevation data`, `elevation tiles`; все с условием `github.repository == 'sergeycw/nakarte'`. Секреты `pull_request` из форков [не получают](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows); `pull_request_target` нет; права `GITHUB_TOKEN` по умолчанию — `read` (`actions/permissions/workflow`). Environment'ов нет: секреты доступны любому workflow на любой ветке, но пушить могут только владелец и агент.

**Рекомендация.**

- Сразу, в коде: токен только в `env` шагов `wrangler`; действия по SHA; точная версия `wrangler` в шагах с токеном (сейчас `npx --yes wrangler@4` тянет последнюю 4.x из npm на каждом деплое).
- Владельцу ([шаги](#шаги-владельца)): разделить токен на деплойный и синхронизационный. По [документации](https://developers.cloudflare.com/workers/authorization/workers/) токен можно ограничить конкретными Worker'ами, деплою с привязкой R2 права на R2 [не нужны](https://developers.cloudflare.com/workers/authorization/workers/), R2 — [конкретным бакетом](https://developers.cloudflare.com/r2/api/tokens/); у токена есть [TTL и фильтр IP](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) (IP раннеров GitHub не постоянны, фильтр не годится). Нужны ли права на R2 для `wrangler pages deploy` с привязкой R2 — в документации не нашлось, проверить ручным деплоем. Сессию Strava — от отдельного аккаунта, не личного.

## 6. Цепочка поставки

| Что | Как сейчас | Риск | Рекомендация |
|---|---|---|---|
| npm, Worker'ы | `npm audit --omit=dev`: 0 у всех четырёх; dev — 5 high (`miniflare`, `sharp`, `undici` через `@cloudflare/vitest-pool-workers` и `wrangler`) | dev-зависимости работают только в тестах и CI; в job'е деплоя они видели токен | закрыто выносом токена в шаг; обновлять вместе с пулом тестов |
| npm, клиент (`yarnpkg audit`) | runtime — 3: `@sentry/browser` (moderate, Sentry выключен), `protocol-buffers-schema` через `pbf` (moderate, prototype pollution при разборе схемы — схемы у нас свои), `snyk` через `alertify.js` (low, в бандл не попадает); dev — 312, из них 9 critical (`@babel/traverse`, `loader-utils`, `webpack-dev-server` и др.) | сборка своего кода; `webpack-dev-server` — только локально; установка 1 183 пакетов шла с токеном в окружении | вынос токена; обновление стека — вместе с переписыванием UI (backlog) |
| cargo (`cargo audit`, `workers/elevation`) | 0 уязвимостей, 0 предупреждений, 130 крейтов | `cargo test` и `cargo install` в job'е деплоя шли с токеном | вынос токена; `cargo audit` в `check-elevation.yml` — P3 |
| Действия GitHub | по тегам: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-java@v6`, `Swatinem/rust-cache@v2`; в апстримном `main.yml` — `actions/*@v2`, `browser-actions/setup-firefox@latest`, `GabrielBB/xvfb-action@v1` | перезаписанный тег стороннего действия исполняется в job'е с токеном. GitHub: SHA — «the only way to use an action as an immutable release» ([secure use](https://docs.github.com/en/actions/reference/security/secure-use)) | свои workflow — по SHA с тегом в комментарии; `main.yml` не трогаем: секретов в нём нет. Политика репозитория «require SHA pinning» ([changelog](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/)) уронит `main.yml` — не включать |
| `ghcr.io/abrensch/brouter:nightly` без digest | `docker create` в job'е Pages, jar и профили уходят в бандл | подменённый образ — чужой jar исполняется у пользователей в CheerpJ | пункт в backlog («Отложено», digest) уже есть; P2 |
| Рантайм CheerpJ с `cjrtnc.leaningtech.com/4.3/loader.js` | скрипт без SRI на origin клона ([browser-engine.js](../../src/lib/brouter/browser-engine.js)) | подмена на CDN — чужой JS на `nakarte-routing.pages.dev`: сессии треков в IndexedDB, запросы к нашим Worker'ам с настоящим `Origin`. Самостоятельный хостинг — только по коммерческой лицензии: Community — «Self-Hosting not allowed» ([licensing](https://cheerpj.com/licensing/)); SRI в документации CheerpJ не описан | принять риск; P3 — SRI на `loader.js`, если версия под путём `/4.3/` неизменна (не подтверждено) |

## 7. Что даёт Cloudflare сверх нынешнего

| Возможность | Что даёт | Доступно сейчас | Цена |
|---|---|---|---|
| `[limits]` `cpu_ms`, `subrequests` | потолок на вызов; «to prevent … denial-of-wallet attacks» ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)) | да, уже используем | бесплатно |
| Привязка rate limiting | частота по ключу, окно 10 или 60 с, по локациям | да, у Worker'ов; у Pages Functions — только через service binding | цена в документации не указана; «Billable usage» после add-worker-limits — $0.00 |
| Отключение Version URL, удаление старых деплоев Pages | закрывает обход лимитов | да | бесплатно |
| Бюджетные оповещения | письмо, считаются раз в сутки, без платы Workers Paid; «do not pause or cap usage» ([budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)) | да: $3, $8 и автоматическое $10 (Cloudflare API, `alerting/v3/policies`) | бесплатно |
| Потолок расходов | нет ни у Workers, ни у R2, ни у аккаунта (там же) | — | — |
| Уведомление Usage Based Billing по продукту | порог по продукту | «Included with: Professional plans or higher» ([notifications](https://developers.cloudflare.com/notifications/notification-available/)); без зоны — нет | Pro-зона |
| Webhook-уведомления | «available on all plans» ([webhooks](https://developers.cloudflare.com/notifications/get-started/configure-webhooks/)); бюджетные оповещения — только письмо | да | бесплатно |
| Свой выключатель | workflow по расписанию читает GraphQL Analytics и выше порога выключает `workers.dev` у Worker'ов | да, своим кодом | полдня; нужен токен с Analytics Read и Workers Scripts Edit — решение владельца |
| Сужение токенов | Worker'ы поштучно, R2 по бакету, TTL | да | бесплатно, шаги владельца |
| Свой домен, зона Free | 5 правил [WAF custom rules](https://developers.cloudflare.com/waf/custom-rules/), 1 правило [rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) (окно 10 с, только IP, блок 10 с), [Bot Fight Mode](https://developers.cloudflare.com/waf/feature-interoperability/); заблокированное до Worker'а [не тарифицируется](https://developers.cloudflare.com/workers/platform/pricing/) и не попадает в метрики Worker'а | нет: своего домена нет | домен по себестоимости ([Registrar](https://www.cloudflare.com/products/registrar/)); прайс Cloudflare (`domains.cloudflare.com/tlds`) отдал 403, сторонний агрегатор называет ≈ $10.5 в год за `.com` и $14.2 продление `.app` — не первоисточник, сверить при покупке |

Бесплатно на текущем плане: `[limits]`, rate limiting, отключение Version URL, удаление деплоев, бюджетные оповещения, webhooks, сужение токенов, DDoS-защита. Свой домен даёт WAF и Bot Fight Mode, но против распределённого клиента правило зоны тоже считает по IP; главная его ценность — переименование и Cache API ([аудит системного дизайна](system-design-audit.md), «Свой домен», P2).

## Итог

Худший сценарий — с одного IP при текущих лимитах ([формулы](#цены-и-как-считаем)); распределённый клиент умножает на число IP. Приоритет: P1 — сделано в этом аудите (строки «сделано»), P2 — следующим, P3 — по необходимости. Каждая строка — отдельный change.

| Угроза | Худший сценарий, $ в месяц | Защита сейчас | Переделка | Цена | Приоритет |
|---|---|---|---|---|---|
| API высот на точках вразброс | ≈ 9 800 | 60 в минуту, ≤ 10 000 точек, 10 с CPU, умолчание 10 000 подзапросов | потолок 512 чтений на запрос, бюджет 2 048 чтений в минуту на IP, явный `subrequests` → ≈ 34 | полдня | сделано, [`limit-elevation-reads`](../changes/archive/2026-10-08-limit-elevation-reads/design.md) |
| Обход лимитов через Version URL старой версии Worker'а | как у старой версии (до 9 800) | нет | `preview_urls = false` | минуты | сделано, [`disable-version-urls`](../changes/archive/2026-10-08-disable-version-urls/design.md) |
| Флуд Pages Functions (`/tiles/`, `/brouter-wasm/`), в том числе через 77 старых деплоев | ≈ 1 700 при 1 000 запросов/с, не ограничен | нет | лимит 1 200 в минуту на IP через service binding в Worker с rate limiting; удаление старых деплоев после деплоя → ≈ 35 | день | сделано, [`limit-pages-functions`](../changes/archive/2026-10-08-limit-pages-functions/design.md) |
| Спам записей треков | +408 за каждый месяц атаки, копится | 60 в минуту, 10 МиБ | 10 записей в минуту, 2 МиБ, алфавит `nktk`, время в метаданных → +13.6 | полдня | сделано, [`limit-track-writes`](../changes/archive/2026-10-08-limit-track-writes/design.md) |
| Утечка `CLOUDFLARE_API_TOKEN` через зависимости в job'е деплоя | не ограничен; потеря треков | условие на репозиторий, `read` у `GITHUB_TOKEN` | токен только у шагов `wrangler`, действия по SHA, точный `wrangler` | час | сделано, [`harden-ci-secrets`](../changes/archive/2026-10-08-harden-ci-secrets/design.md) |
| Прокси как открытый релей, блокировка аккаунта, выкачка heatmap от имени владельца | ≈ 48 (деньги не главное) | 1 200 в минуту, `Origin` | только `GET`/`HEAD`, свои адреса закрыты, 300 в минуту на хосты вне слоёв | полдня | сделано, [`restrict-cors-proxy`](../changes/archive/2026-10-08-restrict-cors-proxy/design.md) |
| Широкий токен Cloudflare | не ограничен | права на весь аккаунт | отдельные токены деплоя и синхронизации, Worker'ы поштучно, R2 по бакету, TTL | час владельца | сделано, [шаги владельца](#шаги-владельца) 1–3 |
| Нет потолка расходов | — | письма $3, $8, $10 раз в сутки | свой выключатель по GraphQL Analytics | полдня | P2, решение владельца |
| Тайлы высот z10–11 на лету | 63–103 | 600 в минуту | общий бюджет чтений R2 с API высот | 2 часа | P2 |
| Сессия Strava — личный аккаунт владельца | доступ к аккаунту | секрет Worker'а | отдельный аккаунт Strava | владелец | P2 |
| Секреты на уровне репозитория | — | — | environment `production` с веткой `master` для секретов деплоя | час, сначала владелец | P2 |
| Образ `brouter:nightly` без digest | чужой jar у пользователей | — | digest в деплое (уже в backlog) | час | P2 |
| Workers Logs под атакой | +0.60 за миллион событий | `head_sampling_rate = 1` | понизить у прокси при росте трафика | минуты | P3 |
| CheerpJ с чужого CDN без SRI | XSS на origin клона | — | SRI на `loader.js`, если версия неизменна | час | P3 |
| Свой домен: WAF, Bot Fight Mode, правило rate limiting | — | — | вместе с переименованием | часы + ≈ $10–15 в год | P2, с переименованием |
| `cargo audit` и `npm audit` в CI | — | разовая проверка этого аудита | шаг в `check-<сервис>.yml` | час | P3 |

## Шаги владельца

Cloudflare (дашборд, агент токены не вводит):

1. Сделано 2026-10-08 (агент в дашборде с разрешения владельца): существующий Account API token «nakarte deploy» (это и был `CLOUDFLARE_API_TOKEN`) сужен до Pages Write на аккаунт и Editor на `nakarte-cors-proxy`, `nakarte-tracks`, `nakarte-elevation`, `nakarte-guard`, без R2, срок до 2027-10-09; значение токена прежнее, секрет не менялся. Ручной `deploy pages` — все job'ы зелёные, включая `prune`. Новый Worker этим токеном не создать: Editor только обновляет существующие.
2. Сделано 2026-10-08 иначе, чем планировалось: REST API объектов R2, в который ходит `wrangler r2 object put`, токен с правом на один бакет не принял (`403`). Синхронизация переведена на S3 API ([sync-tiles-via-s3](../changes/archive/2026-10-08-sync-tiles-via-s3/design.md)), а токен «nakarte-elevation data upload» (ключи `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) получил запись в `nakarte-tiles`. `CLOUDFLARE_TILES_TOKEN` не нужен.
3. Отдельного широкого токена не осталось: сужен сам `nakarte deploy`.
4. Бюджетные оповещения оставить; при желании выключатель расходов — сказать агенту, нужен токен Analytics Read + Workers Scripts Edit в секрете GitHub.

GitHub:

5. Не включать политику «Require actions to be pinned to a full-length commit SHA»: апстримный `main.yml` на тегах упадёт.
6. Environment `production` (Settings → Environments, deployment branches — только `master`), перенести туда `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `R2_*`; потом агент добавит `environment: production` в job'ы с секретами (backlog).

Strava и Google:

7. Завести отдельный аккаунт Strava для heatmap и выпустить `STRAVA_SESSION` из него (`scripts/strava-session-secret.mjs`).
8. Если понадобится `GOOGLE_MAPS_API_KEY`: ограничение Websites `https://nakarte-routing.pages.dev`, API — только Maps JavaScript API, дневная квота в Google Cloud (Quotas) как жёсткий потолок (шаги — backlog, «Отложено»).

## Расхождения кода и документации

- Спека [worker-limits](../specs/worker-limits/spec.md) и design [add-worker-limits](../changes/archive/2026-10-07-add-worker-limits/design.md): «у `nakarte-elevation` потолок подзапросов SHALL оставаться платформенным по умолчанию, чтобы запрос на 10 000 точек вразброс не ломался». По [документации](https://developers.cloudflare.com/workers/platform/limits/#subrequests) обращения к R2 — подзапросы, а умолчание Paid — 10 000, так что запрос на 10 000 точек по разным градусам (до 20 000 чтений) упирается в потолок. GraphQL Analytics показывает у `nakarte-elevation` `subrequests: 0` при тысячах чтений R2 — аналитика привязки R2 в подзапросах не считает.
- [Аудит системного дизайна](system-design-audit.md), п. 7: «10 000 точек вразброс … ≈ 2 000 чтений ≈ $0.0008 за вызов». По коду — до 10 000 чтений, ≈ $0.0036.
- Version URL у всех Worker'ов включены и отвечают, у Pages 77 доступных деплоев — нигде не записано; design `add-worker-limits` («Non-Goals») предлагает при атаке «ручное отключение `workers.dev`», но Version URL включены явно (`previews_enabled: true`) и после этого остались бы открыты.
- Бюджетные оповещения: backlog называет «автоматическое» без суммы — это $10 (`Default budget alert (auto-created)`); по [changelog](https://developers.cloudflare.com/changelog/post/2026-06-15-budget-alerts-default-on/) плата Workers Paid в бюджет не входит, то есть $3 — это $3 сверх подписки.
- [ci-cd.md](../../docs/architecture/ci-cd.md), «Секреты»: права `CLOUDFLARE_API_TOKEN` записаны, но проверить их агенту нечем (`/user/tokens` и `/accounts/{id}/tokens` — `9109 Unauthorized`).
- Design [add-track-storage](../changes/archive/2026-10-07-add-track-storage/design.md): «при злоупотреблении — правило rate limiting в Cloudflare». Правила rate limiting есть только у зоны, своего домена нет.

## Что не проверялось

- Нагрузка на проде не мерилась: цифры — расчёт по прайсу и коду. На проде — только единичные запросы на чтение (Version URL, старый деплой Pages, прокси на свои адреса).
- XSS и прочие уязвимости клиента (апстримный код, разбор GPX/KML, привязки knockout) — вне этого аудита.
- Тарифицируется ли `GetObject` на отсутствующий ключ и пороги DDoS-защиты — в документации нет.
