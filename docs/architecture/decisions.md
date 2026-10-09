# Реестр технических решений

Одна строка на решение: что выбрано, почему коротко и где причина записана полностью. Причину здесь не расширяем: подробности, цифры и отвергнутые варианты — в источнике. «Причина не записана» — решение принято до OpenSpec или его обоснование нигде не сохранилось; восстанавливать его по памяти нельзя, только записать заново отдельным change.

Обозначения источников: `design` — `openspec/changes/archive/<дата>-<имя>/design.md`, `spec` — `openspec/specs/<имя>/spec.md`.

## Платформа и стек

| Решение | Почему | Источник |
|---|---|---|
| Клиент — приложение `web/` на React + Vite + TypeScript, MapLibre, shadcn/ui; клиент автора на Leaflet + knockout удалён | только последние браузеры, светлая тема, красивый и простой UI — решения владельца; стек — ресёрч `openspec/research/new-ui.md`; состав функций — ответы владельца | [record-ui-decisions](../../openspec/changes/archive/2026-10-08-record-ui-decisions/design.md), [record-new-ui-decisions](../../openspec/changes/archive/2026-10-08-record-new-ui-decisions/design.md) |
| Прокладка через BRouter | причина не записана; автор в невлитой ветке выбрал тот же движок | `AGENTS.md`, [«Апстрим»](../../AGENTS.md#апстрим) |
| Движок в браузере на CheerpJ (jar BRouter как есть) | замеры и альтернативы — backlog; сервер роутинга на VPS — только если счёт не вырастет на ≈ $5 в месяц; самый дешёвый годный VPS ≈ +$4.4–7, порог не проходит; Oracle Always Free — попробовать позже | backlog, «Варианты движка в браузере»; [record-ui-decisions](../../openspec/changes/archive/2026-10-08-record-ui-decisions/design.md), [record-new-ui-decisions](../../openspec/changes/archive/2026-10-08-record-new-ui-decisions/design.md) |
| Хостинг клона и своих бэкендов на Cloudflare (Pages, Workers Paid, R2) | ≈ $5–6 в месяц, egress бесплатный; VPS не дешевле и добавляет администрирование и защиту от DDoS; Paid нужен из-за потолка CPU 10 мс на Free | [record-platform-decisions](../../openspec/changes/archive/2026-10-08-record-platform-decisions/design.md) |
| Сервис высот на Rust | решение владельца; записаны требования: ядро без ввода-вывода с адаптерами Worker и VPS, перепаковка без GDAL, память изолята 128 МБ | [record-platform-decisions](../../openspec/changes/archive/2026-10-08-record-platform-decisions/design.md) |
| Свой продукт на базе форка: в апстрим не мерджимся, неиспользуемый код удаляем | решение владельца 2026-10-08, цель — автономия от автора | `AGENTS.md`, [«Апстрим»](../../AGENTS.md#апстрим), backlog, «Глобальное направление» |
| Монорепо: сервис в `workers/<сервис>/`, контракт и клиент одним PR, свой workflow `check-<сервис>.yml` | контракт сервиса и правка клиента одним PR, спеки рядом с кодом; каждый сервис деплоится отдельно | [record-platform-decisions](../../openspec/changes/archive/2026-10-08-record-platform-decisions/design.md); `AGENTS.md`, [«Свои бэкенды вместо `*.nakarte.me`»](../../AGENTS.md#свои-бэкенды-вместо-nakarteme) |
| Приложение рядом со старым клиентом на `/next/` того же Pages-проекта до переноса всех функций | тот же origin: функции, `GUARD` и CORS Worker'ов без изменений, прод с первого change | [add-web-skeleton](../../openspec/changes/archive/2026-10-08-add-web-skeleton/design.md) |
| Переключение: приложение на `/`, `/next/` — редирект `302`, старый клиент удалён целиком | функции перенесены; `302`, а не `301`: `/next/` можно снова занять | [switch-to-web-app](../../openspec/changes/archive/2026-10-09-switch-to-web-app/design.md) |
| Адреса сервисов — одно место `web/src/config.ts`, режим Vite `clone` отличается только движком | свои адреса общие для всех режимов | [add-web-skeleton](../../openspec/changes/archive/2026-10-08-add-web-skeleton/design.md), [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Свои сервисы по умолчанию» |
| Линт `workers/`, `functions/`, `scripts/` — Biome только линтером | eslint уходил со старым клиентом; формат Biome переформатировал бы нетронутые файлы | [switch-to-web-app](../../openspec/changes/archive/2026-10-09-switch-to-web-app/design.md) |

## Прокладка и движок в браузере

| Решение | Почему | Источник |
|---|---|---|
| Выбор движка флагом `routingEngine` | для остального приложения результат одинаковый | [browser-routing-engine](../../openspec/specs/browser-routing-engine/spec.md), «Выбор движка флагом конфигурации» |
| Рантайм CheerpJ с CDN Leaning Technologies | бесплатная лицензия Community работает только с их CDN | [browser-routing-engine](../../openspec/specs/browser-routing-engine/spec.md), «Рантайм с CDN Leaning Technologies» |
| Один движок на страницу, запросы в очередь | CheerpJ разрешает один library-поток на страницу или воркер; второй воркер — ещё ≈ 0.3–0.5 ГБ, параллельный расчёт — backlog | [browser-routing-engine](../../openspec/specs/browser-routing-engine/spec.md); `AGENTS.md`, [«Движок в браузере (CheerpJ)»](../../AGENTS.md#движок-в-браузере-cheerpj); [spike-engine-in-worker](../../openspec/changes/archive/2026-10-08-spike-engine-in-worker/design.md) |
| Движок в Web Worker, запасной путь на главном потоке; отмена не прерывает начатый расчёт | на главном потоке маршрут подвешивает страницу на 0.3 с подряд; перезапуск воркера ради отмены стоит холодного старта | [spike-engine-in-worker](../../openspec/changes/archive/2026-10-08-spike-engine-in-worker/design.md) |
| Тайлы BRouter и файлы движка с origin клона | CheerpJ читает `/app/` только с origin страницы, у brouter.de нет CORS | [sync-world-tiles](../../openspec/changes/archive/2026-10-07-sync-world-tiles/design.md), «Context» |
| Pages Function `brouter-wasm` для Range | статика Pages Range игнорирует, а CheerpJ требует `206` | `AGENTS.md`, [«Движок в браузере (CheerpJ)»](../../AGENTS.md#движок-в-браузере-cheerpj) |
| Патчи `NodesCache` и `OsmNodesMap` вместо форка BRouter | в `/app/` нет каталогов, переполнение стека приходит как `ArithmeticException` | `AGENTS.md`, [«Движок в браузере (CheerpJ)»](../../AGENTS.md#движок-в-браузере-cheerpj) |
| Тайлы BRouter без кеша браузера (`no-store`) | синхронизация перезаписывает тайл под тем же ключом, Chrome склеивает ответ Range из старых и новых байт | [fix-tile-cache-after-sync](../../openspec/changes/archive/2026-10-08-fix-tile-cache-after-sync/proposal.md) |
| Тайлы BRouter в R2, а не на своём сервере | egress бесплатный, free tier покрывает ≈ 250 тыс. маршрутов в месяц | [sync-world-tiles](../../openspec/changes/archive/2026-10-07-sync-world-tiles/design.md) |
| Загрузка тайлов через S3 API R2 (`aws s3 cp`), а не `wrangler r2 object put` | REST API объектов R2 не принимает токен с правом на один бакет, а право на весь аккаунт позволяет удалить треки; ключи — те же, что у высот | [sync-tiles-via-s3](../../openspec/changes/archive/2026-10-08-sync-tiles-via-s3/design.md); раньше — [sync-world-tiles](../../openspec/changes/archive/2026-10-07-sync-world-tiles/design.md) |
| Образ BRouter с тегом `nightly` | у `latest` нет сборки под arm64, CI берёт тот же jar, что локально | [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md); `AGENTS.md`, [«Запуск»](../../AGENTS.md#запуск) |
| Непроложенный отрезок помечается на карте, ошибка — в тосте | решение владельца вместо незаметной прямой старого клиента | [routing](../../openspec/specs/routing/spec.md), «Ошибка прокладки даёт прямой отрезок»; [record-ui-decisions](../../openspec/changes/archive/2026-10-08-record-ui-decisions/design.md) |

## Редактор

| Решение | Почему | Источник |
|---|---|---|
| Модель линии — опорные точки и отрезки, неизменяемые данные; ответ роутера применяется, только если его запрос ещё в линии | устаревшие ответы отсекаются без флагов; модель тестируется без карты | [add-web-route-editor](../../openspec/changes/archive/2026-10-09-add-web-route-editor/design.md) |
| Разметка маршрута — номера опорных точек рядом с геометрией: автосохранение в IndexedDB и необязательное поле `nktk` версии 4 | точные координаты без сетки; совместимость ссылок с nakarte.me не нужна | [add-web-autosave](../../openspec/changes/archive/2026-10-09-add-web-autosave/design.md); [record-ui-decisions](../../openspec/changes/archive/2026-10-08-record-ui-decisions/design.md) |
| Сессия старого клиента подхватывается один раз — последняя, только без своей записи | треки не пропадают с переключением; меню сессий нет, все 100 сессий — свалка | [switch-to-web-app](../../openspec/changes/archive/2026-10-09-switch-to-web-app/design.md) |
| Ключи разметки по координатам, `_drawingDirection` до `spliceLatLngs` | отменено вместе со старым редактором; ключи сетки читает только подхват сессии | [fix-route-markup-after-reload](../../openspec/changes/archive/2026-10-07-fix-route-markup-after-reload/design.md) |

## Хранилище треков

| Решение | Почему | Источник |
|---|---|---|
| R2, ключ объекта — ключ ссылки | записи неизменяемые; KV даёт лимит 25 МиБ и платную запись без выигрыша | [add-track-storage](../../openspec/changes/archive/2026-10-07-add-track-storage/design.md) |
| md5 той же `blueimp-md5`, что у клиента | побайтное совпадение ключа без риска кодировки строки | [add-track-storage](../../openspec/changes/archive/2026-10-07-add-track-storage/design.md) |
| Лимит тела 2 МиБ, 10 записей в минуту с IP, тело только из алфавита ссылки | 10 МиБ × 60 записей в минуту давали ≈ 27 ТБ хранения за месяц атаки; реальная ссылка — 3–4 байта на точку | [limit-track-writes](../../openspec/changes/archive/2026-10-08-limit-track-writes/design.md) |

## Сервис высот

| Решение | Почему | Источник |
|---|---|---|
| Данные viewfinderpanoramas 3″, как у автора | контрактный тест совпадает с автором; GLO-30 — в 5–10 раз больше и другие данные | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Данные» |
| Объект на градус, куски автора 301×301, zstd от дельт | арифметика автора буквально; атомарная замена градуса; дельты хорошо жмутся | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Формат» |
| Ядро без ввода-вывода и адаптеры Worker / `axum` | один код в Worker и на VPS | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Ядро и адаптеры» |
| Кеш в памяти изолята вместо Cache API | Cache API на `*.workers.dev` не работает, своего домена нет | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Ядро и адаптеры» |
| Заливка `dem3` через S3 API R2 | `wrangler r2 bulk put` залил бы мир за ~19 часов при лимите job 350 минут | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Перепаковка и загрузка» |
| Тайлы z0–9 из архива, z10–11 на лету | отменено: тайлы высот выведены вместе со старым клиентом, тени рельефа — AWS Terrain Tiles; архив в R2 остаётся до решения владельца, Worker его не читает | [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md), «z0–9 заранее, z10–11 на лету»; [record-new-ui-decisions](../../openspec/changes/archive/2026-10-08-record-new-ui-decisions/design.md), «Тени рельефа из AWS Terrain Tiles, тайлы высот выводятся»; [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md), «Тайлы высот: удаляется маршрут и весь код вокруг него» |
| Плотный индекс архива вместо PMTiles | отменено вместе с тайлами высот (строка выше) | [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md), «Формат архива» |
| Тайлы с CORS `*`, gzip без пережатия | отменено вместе с тайлами высот (строка выше) | [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md), «Маршрут и заголовки» |

## CORS-прокси и Strava

| Решение | Почему | Источник |
|---|---|---|
| Протокол авторского прокси | клиент nakarte работает без правок | [cors-proxy](../../openspec/specs/cors-proxy/spec.md), «Purpose» |
| `HEAD` уходит как `GET`, пересылается `User-Agent` | `GET` нужен коротким ссылкам mapy.com, `User-Agent` — Wikimapia у автора; Wikimapia ушла, `User-Agent` оставлен: часть сайтов без него отвечает `403` | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Strava heatmap и Wikimapia через свой прокси»; [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md), «Прокси: без `/wikimapia/`, слои — только те, что шлёт приложение» |
| Origin karma `localhost:9876` в прокси | отменено: karma ушла вместе со старым клиентом (строка ниже) | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Origin karma в прокси» |
| `ALLOWED_ORIGINS` прокси, треков и высот — сайт, `localhost:8769` и `localhost:4173` | локальное приложение и `vite preview` ходят в живые сервисы, как раньше старый клиент; `Origin` всё равно подделывается, защищают лимиты | [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md), «`ALLOWED_ORIGINS`: 8769 и 4173 вместо 8765, 8766, 9876» |
| Маршрута `/wikimapia/` нет, в лимите слоёв только Strava heatmap, Tsvetkov и Tracestrack | остальные слои приложение шлёт напрямую; хост, забытый в списке, получает меньший лимит, а не ломается | [retire-old-client-services](../../openspec/changes/archive/2026-10-09-retire-old-client-services/design.md), «Прокси: без `/wikimapia/`, слои — только те, что шлёт приложение» |
| Куки heatmap обновляет прокси по сессии `STRAVA_SESSION` | куки живут около суток, их ставит страница heatmap вошедшему | [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md) |
| Кеш кук в изоляте, а не Cron + KV | одно обновление на изолят в сутки, без нового ресурса | [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md), п. 5 |
| Заголовок `X-Strava-Cookies` | отличить сессию от запасных кук снаружи | [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md), п. 9 |
| Анонимные тайлы подменяет прокси, а не клиент | клиент не знает про сессию, z13–16 живы, пока жива сессия | [add-strava-anonymous-fallback](../../openspec/changes/archive/2026-10-08-add-strava-anonymous-fallback/design.md) |
| Ключ Tracestrack — секрет прокси `TRACESTRACK_KEY`, только для растра `topo__`; без ключа `503` | в бандле ключ увидели бы все; векторные тайлы и API Tracestrack по 6 кредитов через прокси с поддельным `Origin` тратили бы квоту | [add-outdoor-basemap](../../openspec/changes/add-outdoor-basemap/design.md), «Ключ — в прокси, только для тайлов `topo__`» |
| Прокси только читает, свои адреса закрыты, лимит по роли хоста цели | открытый релей с IP Cloudflare грозит блокировкой аккаунта; печать своих слоёв и импорт идут на любые хосты, поэтому вместо списка — меньший лимит | [restrict-cors-proxy](../../openspec/changes/archive/2026-10-08-restrict-cors-proxy/design.md) |

## Деплой и защита

| Решение | Почему | Источник |
|---|---|---|
| Деплой на каждый push в `master`, последний побеждает | прод совпадает с `master`; публикация Pages атомарна | [clone-deploy](../../openspec/specs/clone-deploy/spec.md); [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md) |
| Выкатываются только изменённые сервисы, база — последний успешный деплой | правка документации не сбрасывает изоляты; отменённый или упавший прогон не теряет изменений | [deploy-per-service](../../openspec/changes/archive/2026-10-08-deploy-per-service/design.md) |
| Тесты сервиса — шаг его деплоя, Worker'ы раньше Pages | Worker не выкатывается без тестов; клиент не опережает сервис при смене контракта | [deploy-per-service](../../openspec/changes/archive/2026-10-08-deploy-per-service/design.md) |
| `docker create` и явная проверка файлов движка | контейнер не нужно запускать; локальная сборка без него работает как раньше | [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md) |
| `npx --yes` с точной версией `wrangler` из переменной `WRANGLER`, без `devDependencies` | не трогать `package.json`; шаг с токеном не тянет новую 4.x | [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md), [harden-ci-secrets](../../openspec/changes/archive/2026-10-08-harden-ci-secrets/design.md) |
| Секреты Cloudflare только в `env` шагов `wrangler`, действия по SHA | установка зависимостей, тесты и сборка не видят токен; перезаписанный тег не меняет код рядом с секретами | [harden-ci-secrets](../../openspec/changes/archive/2026-10-08-harden-ci-secrets/design.md) |
| Статическая проверка бандла на `*.nakarte.me` | деплой не выкатит обращение к инфраструктуре автора | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Статическая проверка бандла» |
| Синтетическая проверка прода и Workers Logs | поломку видно раньше пользователя, ошибку Worker'а можно найти после | [clone-monitoring](../../openspec/specs/clone-monitoring/spec.md); [add-prod-monitoring](../../openspec/changes/archive/2026-10-08-add-prod-monitoring/proposal.md) |
| Частота — привязка Workers Rate Limiting | Durable Object даёт задержку на каждый запрос, KV дороже самого запроса | [add-worker-limits](../../openspec/changes/archive/2026-10-07-add-worker-limits/design.md) |
| Сначала `Origin`, потом частота | чужой запрос не тратит счётчик, `429` приходит с CORS | [add-worker-limits](../../openspec/changes/archive/2026-10-07-add-worker-limits/design.md), «Порядок проверок» |
| `cpu_ms` с запасом от наблюдённого максимума | защита от перерасхода на Cloudflare; цифры — от замеров | [add-worker-limits](../../openspec/changes/archive/2026-10-07-add-worker-limits/design.md), «Потолок на вызов» |
| Version URL выключены, у Pages только текущий деплой | старая версия со старыми лимитами обходила бы новые | [disable-version-urls](../../openspec/changes/archive/2026-10-08-disable-version-urls/design.md), [limit-pages-functions](../../openspec/changes/archive/2026-10-08-limit-pages-functions/design.md) |
| Потолок 512 чтений R2 на запрос API высот и бюджет 2 048 чтений в минуту с IP | 10 000 точек вразброс — до 10 000 чтений класса B на вызов; привязка считает вызовы без веса, поэтому единица — 64 чтения | [limit-elevation-reads](../../openspec/changes/archive/2026-10-08-limit-elevation-reads/design.md) |
| Лимит Pages Functions — закрытый Worker `nakarte-guard` по service binding | привязку rate limiting Pages не поддерживают; вызов по service binding не тарифицируется как запрос; middleware в каталоге функции, чтобы статика осталась бесплатной | [limit-pages-functions](../../openspec/changes/archive/2026-10-08-limit-pages-functions/design.md) |

## Панорамы и слои

| Решение | Почему | Источник |
|---|---|---|
| Подложка по умолчанию — Tracestrack Topo (`Tt`), а не свой векторный стиль на OpenFreeMap | решение владельца 2026-10-09: готовый туристический растр openstreetmap.org; свой стиль — 3–5 дней работы | [add-outdoor-basemap](../../openspec/changes/add-outdoor-basemap/design.md), «Context»; ресёрч `openspec/research/new-ui.md`, «Подложка по умолчанию» |
| Ошибка тайлов `Tt` — откат на OSM до перезагрузки, сохранённый выбор не меняется | карта без ключа или квоты осталась бы серой; запись отката как выбора навсегда пересаживала бы на OSM | [add-outdoor-basemap](../../openspec/changes/add-outdoor-basemap/design.md), «Откат на OpenStreetMap — до перезагрузки» |
| Слои и провайдеры на данных автора удаляются, а не прячутся | владелец снял правило малого диффа с апстримом | [drop-author-scan-layers](../../openspec/changes/archive/2026-10-08-drop-author-scan-layers/design.md), [remove-panorama-providers](../../openspec/changes/archive/2026-10-08-remove-panorama-providers/design.md) |
| Street View без ключа: пустой ключ по умолчанию, ключ — только переменной сборки `VITE_GOOGLE_MAPS_API_KEY` из секрета `GOOGLE_MAPS_API_KEY` | ключ один на сайт, тесты идут без него | [keyless-street-view](../../openspec/changes/archive/2026-10-08-keyless-street-view/design.md), [add-web-search-panoramas](../../openspec/changes/archive/2026-10-09-add-web-search-panoramas/design.md) |
| CSS режима без ключа только под классом `google-street-view-keyless` | с ключом панорама не должна инвертироваться | [hide-street-view-dev-overlay](../../openspec/changes/archive/2026-10-08-hide-street-view-dev-overlay/design.md) |
| Фильтры слоёв и провайдеров в `config-target` | отменено: заменено удалением (две строки выше) | [hide-map-data-layers](../../openspec/changes/archive/2026-10-07-hide-map-data-layers/design.md), [hide-panorama-providers](../../openspec/changes/archive/2026-10-07-hide-panorama-providers/design.md) |
