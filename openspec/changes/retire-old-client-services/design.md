# Design

## Context

Зачем — [proposal](proposal.md), поведение — спеки change. Это вторая половина change 9 [ресёрча](../../research/new-ui.md#changes-по-порядку): разрез и почему не одним change — [switch-to-web-app](../archive/2026-10-09-switch-to-web-app/design.md#разрез-два-change-агент). Решение о выводе тайлов высот — архив [record-new-ui-decisions](../archive/2026-10-08-record-new-ui-decisions/design.md); как тайлы устроены — архив [add-elevation-tiles](../archive/2026-10-07-add-elevation-tiles/design.md); лимиты — [add-worker-limits](../archive/2026-10-07-add-worker-limits/design.md).

Что выяснилось при чтении кода (`master` `68ab495`, 2026-10-09):

- Потребитель тайлов высот на проде — никто: приложение на `/` ходит в Worker высот только за API (`ELEVATION_SERVER_URL` в `web/src/config.ts`, `elevation/api.ts`), отмывка — AWS Terrain Tiles, старого клиента нет с деплоя `switch-to-web-app`. Их проверяет только `scripts/prod-check.sh` (две строки).
- В ядре Worker'а высот тайлам принадлежат `core/src/archive.rs`, `render.rs`, `tile.rs` и ветка `/tiles/` в `http.rs` (`TILES_PREFIX`, `RateGroup::Tiles`, `respond_tile`, `tile_body`); API их не использует. Генератор архива — крейт `tiles/` (`elevation-tiles build` и `thin`), его тесты — `core/tests/tiles.rs`, тесты Worker'а — `test/tiles.test.js` и половина `test/limits.test.js`, фикстуры — `fixtures/tiles/` (тайлы автора) и куски `fixtures/dem3/`, дописанные `elevation-tiles thin`. Адаптер `worker/src/lib.rs` выбирает счётчик `TILES_RATE_LIMITER` и отдаёт уже сжатое тело (`EncodeBody::Manual`) — второе нужно только тайлам. Заливка архива — `scripts/elevation-tiles.sh` в `workers/elevation/` и workflow `elevation tiles`.
- Прокси: `PATH_ALIASES` (`/wikimapia/` → `http://wikimapia.org/`) нужен был только слою Wikimapia старого клиента; `LAYER_HOSTS` (общий лимит 1 200) перечисляет `wikimapia.org`, `wmts10.geo.admin.ch`, `slazav.xyz`, `static.mapy.hiking.sk` — слои, которые старый клиент слал через прокси (`urlViaCorsProxy` и `noCors` для печати). Приложение шлёт через прокси из каталога только Strava (`content-*.strava.com`) и Tsvetkov (`maptiles.website.yandexcloud.net`); swisstopo, Slazav и Slovakia — напрямую по конечным адресам с CORS ([catalog.ts](../../../web/src/layers/catalog.ts)).
- `ALLOWED_ORIGINS`: прокси — сайт, 8765, 8766, 9876; треки и высоты — сайт, 8765, 8766. Старых dev-серверов и karma больше нет, а 8769 (dev-сервер приложения) и 4173 (`vite preview`) не разрешены — отсюда подвох `AGENTS.md`: локально не работают прокси, «Copy link», профиль высот.

## Goals / Non-Goals

**Goals:**
- В Worker'ах нет кода и настроек, у которых не осталось потребителя после удаления старого клиента.
- Локальный dev-сервер приложения ходит в боевые Worker'ы так же, как раньше ходил старый.
- API высот, хранилище треков, Strava и остальной прокси не меняют поведения.

**Non-Goals:**
- Удаление архива `tiles/elevation-z0-9` из R2 без явного «да» владельца (см. Migration Plan).
- Прореживание `fixtures/dem3/` под одни тесты API: лишние куски — ≈ сотни КБ, пересборка — `make_reference.py` с запросами к автору; оставить.
- Перевод рельефа на свои данные высот — отмывка уже из AWS Terrain Tiles.

## Decisions

Решения, которых нет в ресёрче, архивах и задаче change, помечены **[агент]**.

### Тайлы высот: удаляется маршрут и весь код вокруг него

`/tiles/` уходит из `http::handle`: запрос на этот путь дальше обрабатывается как запрос API — без `Origin` `403 Origin not allowed`, с разрешённым — `405` на `GET` (как любой не-`POST`). Отдельный `404` для бывшего маршрута не делаем **[агент]**: клиента у него нет, а лишняя ветка — тот же код, который мы убираем. Удаляются `archive`, `render`, `tile` ядра, `core/tests/tiles.rs`, крейт `tiles` из воркспейса, `fixtures/tiles/`, `test/tiles.test.js`, тайловая часть `test/limits.test.js` и `vitest.config.js`, `TILES_RATE_LIMITER` (счётчик `1001` освобождается — комментарии `namespace_id` во всех `wrangler.toml` правятся), `EncodeBody::Manual` в адаптере, `scripts/elevation-tiles.sh`, workflow `elevation tiles`. Фича `encode` (C-шный `zstd`) остаётся — её берёт `repack`.

### Прокси: без `/wikimapia/`, слои — только те, что шлёт приложение

`PATH_ALIASES` удаляется вместе с ветвью в `targetUrl`: `/wikimapia/…` получает `404`, как любой путь не по формату. `LAYER_HOSTS` — Strava и Tsvetkov **[агент]**: остальные хосты приложение напрямую не шлёт через прокси, а если пользователь направит свой слой через прокси, он и раньше шёл в общий лимит 300. Пересылка `User-Agent` остаётся: её требовала Wikimapia, а без неё часть сайтов отвечает `403` (`fetch` из Worker'а своего не ставит); проверять каждый сайт импорта ради удаления строки не стоит **[агент]**.

### `ALLOWED_ORIGINS`: 8769 и 4173 вместо 8765, 8766, 9876 **[агент]**

Ровно как раньше у старого клиента: локальный dev-сервер приложения и `vite preview` получают живые сервисы. Риск тот же, что был: любая страница на `localhost:8769` у кого угодно может звать прокси — `Origin` всё равно подделывается не-браузером, защиту держат лимиты. e2e от списка не зависят: все ответы сервисов подменяет фикстура `network`.

### Тесты

- Rust: `cargo test --workspace` без тайлов; новые тесты ядра — `GET /tiles/0/0/0` без `Origin` даёт `403`, с разрешённым — `405` (маршрута больше нет); `rate_group` для `/tiles/…` без `Origin` — `None`.
- Worker в `workerd` (`npm test` в `workers/elevation`): `limits.test.js` — лимит API отдельным счётчиком без тайлов; `elevation.test.js` — origin `http://localhost:8769` вместо 8766.
- Прокси: `/wikimapia/…` — `404`; origin 8769 и 4173 проходят, 9876 и 8765 — `403`; лимит слоёв — на Tsvetkov вместо `slazav.xyz`.
- Треки: origin 8769 проходит (тест origin в `workers/tracks`).
- `scripts/prod-check.sh` без строк тайлов высот.

### Ревью диффа

Независимое ревью субагентом 2026-10-09: высоких и средних дефектов нет (проверки Worker'ов, `cargo metadata --locked`, пробный `openspec archive` на копии — спека `elevation-tiles` удаляется целиком). Низкие, исправлены: ссылки ресёрчей на удаляемую спеку `elevation-tiles` (теперь — на архив `add-elevation-tiles`), открытый P2 «тайлы z10–11» в `security-audit.md` и ресёрче (помечен закрытым), недостижимая ветка `too_many_requests` без `Origin` (функция принимает origin), нет сценария и теста на 4173 у прокси и Worker'а высот, документы объясняли `User-Agent` короткими ссылками mapy.com (им нужен `GET` вместо `HEAD`, а `User-Agent` оставлен из-за сайтов, отвечающих `403` без него). При archive — Purpose спеки `cors-proxy` без печати. Не исправлено (к сведению): 4173 — порт `vite preview` любого Vite-проекта, и такой превью на чужой машине может звать прокси и хранилище треков; так же было с портами старого клиента, `Origin` подделывается и без браузера, защиту держат лимиты.

## Risks / Trade-offs

- [Кто-то держит ссылку на тайлы высот клона] → внешних потребителей у клона не было: адрес нигде не публиковался, кроме конфигурации старого клиента.
- [Архив остаётся в R2 до решения владельца] → ≈ $0.06 в месяц; Worker его не читает.
- [Откат] → revert и push: Worker'ы передеплоятся с тайлами, архив в R2 цел, пока владелец его не удалил.

## Migration Plan

1. PR в `master`: `check elevation`, `check cors proxy`, `check tracks`, `check lint` зелёные; ревью диффа субагентом.
2. Merge → `deploy pages` выкатывает `nakarte-elevation`, `nakarte-cors-proxy`, `nakarte-tracks`; `smoke` — без строк тайлов.
3. На проде: `GET /tiles/5/19/11` у Worker'а высот — не `200`; API высот, профиль высот на `/` и импорт по ссылке через прокси работают; `Origin: http://localhost:8769` у прокси, треков и высот — разрешён, `http://localhost:9876` — `403`.
4. **Шаг владельца (необратимо):** удалить объект `tiles/elevation-z0-9` из бакета `nakarte-elevation` — например `npx wrangler@4 r2 object delete nakarte-elevation/tiles/elevation-z0-9 --remote` из любого каталога (wrangler залогинен OAuth) или в дашборде Cloudflare. Агент удаляет его только после явного «да» владельца.

## Проверки
