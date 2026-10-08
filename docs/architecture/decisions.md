# Реестр технических решений

Одна строка на решение: что выбрано, почему коротко и где причина записана полностью. Причину здесь не расширяем: подробности, цифры и отвергнутые варианты — в источнике. «Причина не записана» — решение принято до OpenSpec или его обоснование нигде не сохранилось; восстанавливать его по памяти нельзя, только записать заново отдельным change.

Обозначения источников: `design` — `openspec/changes/archive/<дата>-<имя>/design.md`, `spec` — `openspec/specs/<имя>/spec.md`.

## Платформа и стек

| Решение | Почему | Источник |
|---|---|---|
| Клиент на Leaflet + knockout, сборка webpack | причина не записана (стек апстрима) | — |
| Прокладка через BRouter | причина не записана; автор в невлитой ветке выбрал тот же движок | `AGENTS.md`, [«Апстрим»](../../AGENTS.md#апстрим) |
| Движок в браузере на CheerpJ (jar BRouter как есть) | причина не записана; замеры и альтернативы есть | backlog, «Варианты движка в браузере» |
| Хостинг клона и своих бэкендов на Cloudflare (Pages, Workers Paid, R2) | ≈ $5–6 в месяц, egress бесплатный; VPS не дешевле и добавляет администрирование и защиту от DDoS; Paid нужен из-за потолка CPU 10 мс на Free | [record-platform-decisions](../../openspec/changes/archive/2026-10-08-record-platform-decisions/design.md) |
| Сервис высот на Rust | решение владельца; записаны требования: ядро без ввода-вывода с адаптерами Worker и VPS, перепаковка без GDAL, память изолята 128 МБ | [record-platform-decisions](../../openspec/changes/archive/2026-10-08-record-platform-decisions/design.md) |
| Свой продукт на базе форка: в апстрим не мерджимся, неиспользуемый код удаляем | решение владельца 2026-10-08, цель — автономия от автора | `AGENTS.md`, [«Апстрим»](../../AGENTS.md#апстрим), backlog, «Глобальное направление» |
| Монорепо: сервис в `workers/<сервис>/`, контракт и клиент одним PR, свой workflow `check-<сервис>.yml` | контракт сервиса и правка клиента одним PR, спеки рядом с кодом; каждый сервис деплоится отдельно | [record-platform-decisions](../../openspec/changes/archive/2026-10-08-record-platform-decisions/design.md); `AGENTS.md`, [«Свои бэкенды вместо `*.nakarte.me`»](../../AGENTS.md#свои-бэкенды-вместо-nakarteme) |
| `config-target` только для различий клона и серверного режима | свои адреса общие для всех сборок, клон отличается только движком | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Свои сервисы по умолчанию» |

## Прокладка и движок в браузере

| Решение | Почему | Источник |
|---|---|---|
| Выбор движка флагом `routingEngine` | для остального приложения результат одинаковый | [browser-routing-engine](../../openspec/specs/browser-routing-engine/spec.md), «Выбор движка флагом конфигурации» |
| Рантайм CheerpJ с CDN Leaning Technologies | бесплатная лицензия Community работает только с их CDN | [browser-routing-engine](../../openspec/specs/browser-routing-engine/spec.md), «Рантайм с CDN Leaning Technologies» |
| Один движок на страницу, запросы в очередь | CheerpJ разрешает один library-поток | [browser-routing-engine](../../openspec/specs/browser-routing-engine/spec.md); `AGENTS.md`, [«Движок в браузере (CheerpJ)»](../../AGENTS.md#движок-в-браузере-cheerpj) |
| Тайлы BRouter и файлы движка с origin клона | CheerpJ читает `/app/` только с origin страницы, у brouter.de нет CORS | [sync-world-tiles](../../openspec/changes/archive/2026-10-07-sync-world-tiles/design.md), «Context» |
| Pages Function `brouter-wasm` для Range | статика Pages Range игнорирует, а CheerpJ требует `206` | `AGENTS.md`, [«Движок в браузере (CheerpJ)»](../../AGENTS.md#движок-в-браузере-cheerpj) |
| Патчи `NodesCache` и `OsmNodesMap` вместо форка BRouter | в `/app/` нет каталогов, переполнение стека приходит как `ArithmeticException` | `AGENTS.md`, [«Движок в браузере (CheerpJ)»](../../AGENTS.md#движок-в-браузере-cheerpj) |
| Тайлы BRouter в R2, а не на своём сервере | egress бесплатный, free tier покрывает ≈ 250 тыс. маршрутов в месяц | [sync-world-tiles](../../openspec/changes/archive/2026-10-07-sync-world-tiles/design.md) |
| Загрузка тайлов через `wrangler r2 object put` | самый большой тайл 253 МБ при лимите 315 МБ, multipart не нужен | [sync-world-tiles](../../openspec/changes/archive/2026-10-07-sync-world-tiles/design.md) |
| Образ BRouter с тегом `nightly` | у `latest` нет сборки под arm64, CI берёт тот же jar, что локально | [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md); `AGENTS.md`, [«Запуск»](../../AGENTS.md#запуск) |
| Ошибка прокладки даёт прямой отрезок | причина не записана | [routing](../../openspec/specs/routing/spec.md), «Ошибка прокладки даёт прямой отрезок» |

## Редактор

| Решение | Почему | Источник |
|---|---|---|
| Разметка маршрута в сессии, ключи по координатам | номера узлов между перезагрузками не стабильны | [route-editing](../../openspec/specs/route-editing/spec.md), «Разметка маршрута переживает перезагрузку»; `AGENTS.md`, [«Где код роутинга»](../../AGENTS.md#где-код-роутинга) |
| Обнулять `_drawingDirection` до `spliceLatLngs` | сохранение сессии внутри `nodeschanged` отрезало последнюю точку | [fix-route-markup-after-reload](../../openspec/changes/archive/2026-10-07-fix-route-markup-after-reload/design.md) |
| Ссылки и экспорт несут только геометрию | причина не записана | [route-editing](../../openspec/specs/route-editing/spec.md), «Ссылки и экспорт несут только геометрию» |

## Хранилище треков

| Решение | Почему | Источник |
|---|---|---|
| R2, ключ объекта — ключ ссылки | записи неизменяемые; KV даёт лимит 25 МиБ и платную запись без выигрыша | [add-track-storage](../../openspec/changes/archive/2026-10-07-add-track-storage/design.md) |
| md5 той же `blueimp-md5`, что у клиента | побайтное совпадение ключа без риска кодировки строки | [add-track-storage](../../openspec/changes/archive/2026-10-07-add-track-storage/design.md) |
| Лимит тела 10 МиБ | с запасом для реальных треков, ограничивает злоупотребление | [add-track-storage](../../openspec/changes/archive/2026-10-07-add-track-storage/design.md) |

## Сервис высот

| Решение | Почему | Источник |
|---|---|---|
| Данные viewfinderpanoramas 3″, как у автора | контрактный тест совпадает с автором; GLO-30 — в 5–10 раз больше и другие данные | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Данные» |
| Объект на градус, куски автора 301×301, zstd от дельт | арифметика автора буквально; атомарная замена градуса; дельты хорошо жмутся | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Формат» |
| Ядро без ввода-вывода и адаптеры Worker / `axum` | один код в Worker и на VPS | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Ядро и адаптеры» |
| Кеш в памяти изолята вместо Cache API | Cache API на `*.workers.dev` не работает, своего домена нет | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Ядро и адаптеры» |
| Заливка `dem3` через S3 API R2 | `wrangler r2 bulk put` залил бы мир за ~19 часов при лимите job 350 минут | [add-elevation-api](../../openspec/changes/archive/2026-10-07-add-elevation-api/design.md), «Перепаковка и загрузка» |
| Тайлы z0–9 из архива, z10–11 на лету | пирамида целиком ≈ 38 ГБ, z0–9 ≈ 3.8 ГБ | [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md), «z0–9 заранее, z10–11 на лету» |
| Плотный индекс архива вместо PMTiles | 4 МБ, читается арифметикой, без разбора сжатых директорий в wasm | [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md), «Формат архива» |
| Тайлы с CORS `*`, gzip без пережатия | как у автора; тайлы идут без `withCredentials` | [add-elevation-tiles](../../openspec/changes/archive/2026-10-07-add-elevation-tiles/design.md), «Маршрут и заголовки» |

## CORS-прокси и Strava

| Решение | Почему | Источник |
|---|---|---|
| Протокол авторского прокси | клиент nakarte работает без правок | [cors-proxy](../../openspec/specs/cors-proxy/spec.md), «Purpose» |
| `HEAD` уходит как `GET`, пересылается `User-Agent` | так работали короткие ссылки mapy.com и Wikimapia у автора | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Strava heatmap и Wikimapia через свой прокси» |
| Origin karma `localhost:9876` в прокси | тесты проверяют путь клиента через свой прокси, `Origin` всё равно подделывается | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Origin karma в прокси» |
| Куки heatmap обновляет прокси по сессии `STRAVA_SESSION` | куки живут около суток, их ставит страница heatmap вошедшему | [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md) |
| Кеш кук в изоляте, а не Cron + KV | одно обновление на изолят в сутки, без нового ресурса | [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md), п. 5 |
| Заголовок `X-Strava-Cookies` | отличить сессию от запасных кук снаружи | [add-strava-heatmap-refresh](../../openspec/changes/archive/2026-10-08-add-strava-heatmap-refresh/design.md), п. 9 |
| Анонимные тайлы подменяет прокси, а не клиент | клиент не знает про сессию, z13–16 живы, пока жива сессия | [add-strava-anonymous-fallback](../../openspec/changes/archive/2026-10-08-add-strava-anonymous-fallback/design.md) |

## Деплой и защита

| Решение | Почему | Источник |
|---|---|---|
| Деплой на каждый push в `master`, последний побеждает | прод совпадает с `master`; публикация Pages атомарна | [clone-deploy](../../openspec/specs/clone-deploy/spec.md); [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md) |
| `docker create` и явная проверка файлов движка | контейнер не нужно запускать; локальная сборка без него работает как раньше | [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md) |
| `npx --yes wrangler@4` без `devDependencies` | не трогать `package.json` | [add-pages-autodeploy](../../openspec/changes/archive/2026-10-07-add-pages-autodeploy/design.md) |
| Статическая проверка бандла на `*.nakarte.me` | деплой не выкатит обращение к инфраструктуре автора | [drop-author-services](../../openspec/changes/archive/2026-10-08-drop-author-services/design.md), «Статическая проверка бандла» |
| Частота — привязка Workers Rate Limiting | Durable Object даёт задержку на каждый запрос, KV дороже самого запроса | [add-worker-limits](../../openspec/changes/archive/2026-10-07-add-worker-limits/design.md) |
| Сначала `Origin`, потом частота | чужой запрос не тратит счётчик, `429` приходит с CORS | [add-worker-limits](../../openspec/changes/archive/2026-10-07-add-worker-limits/design.md), «Порядок проверок» |
| `cpu_ms` с запасом от наблюдённого максимума | защита от перерасхода на Cloudflare; цифры — от замеров | [add-worker-limits](../../openspec/changes/archive/2026-10-07-add-worker-limits/design.md), «Потолок на вызов» |

## Панорамы и слои

| Решение | Почему | Источник |
|---|---|---|
| Слои и провайдеры на данных автора удаляются, а не прячутся | владелец снял правило малого диффа с апстримом | [drop-author-scan-layers](../../openspec/changes/archive/2026-10-08-drop-author-scan-layers/design.md), [remove-panorama-providers](../../openspec/changes/archive/2026-10-08-remove-panorama-providers/design.md) |
| Street View без ключа, пустой ключ в деплое, а не в `config-target` | ключ в `config-target` перебил бы подстановку ключа из секрета `GOOGLE_MAPS_API_KEY` | [keyless-street-view](../../openspec/changes/archive/2026-10-08-keyless-street-view/design.md) |
| CSS режима без ключа только под классом `google-street-view-keyless` | с ключом панорама не должна инвертироваться | [hide-street-view-dev-overlay](../../openspec/changes/archive/2026-10-08-hide-street-view-dev-overlay/design.md) |
| Фильтры слоёв и провайдеров в `config-target` | отменено: заменено удалением (две строки выше) | [hide-map-data-layers](../../openspec/changes/archive/2026-10-07-hide-map-data-layers/design.md), [hide-panorama-providers](../../openspec/changes/archive/2026-10-07-hide-panorama-providers/design.md) |
