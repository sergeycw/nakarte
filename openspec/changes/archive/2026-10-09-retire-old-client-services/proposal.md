# Proposal

## Why

Старый клиент удалён (change [switch-to-web-app](../2026-10-09-switch-to-web-app/design.md)), а Worker'ы ещё держат то, что было нужно только ему: тайлы высот для высоты под курсором (маршрут `/tiles/` Worker'а высот, генератор архива, workflow заливки, расчёт z10–11 на лету без бюджета чтений R2 — P2 backlog), маршрут прокси `/wikimapia/` для удалённого слоя Wikimapia и origin старых dev-серверов (8765, 8766) и karma (9876) в `ALLOWED_ORIGINS`. Решение владельца — тайлы высот выводятся ([record-new-ui-decisions](../2026-10-08-record-new-ui-decisions/design.md), «Тени рельефа из AWS Terrain Tiles, тайлы высот выводятся»); это вторая половина change 9 [списка ресёрча](../../../research/new-ui.md#changes-по-порядку).

## What Changes

- **BREAKING** `nakarte-elevation` больше не отдаёт тайлы высот: маршрут `/tiles/`, его счётчик частоты `TILES_RATE_LIMITER`, расчёт тайлов (`archive`, `render`, `tile` ядра), генератор архива (крейт `tiles`), его фикстуры и тесты, workflow `elevation tiles` и `scripts/elevation-tiles.sh` удаляются. API высот (`POST /`) не меняется.
- Архив `tiles/elevation-z0-9` в R2 (≈ 3.8 ГБ) после деплоя никто не читает; удаление необратимо — только с явного «да» владельца, иначе шаг владельца в design.
- **BREAKING** `nakarte-cors-proxy` больше не знает адрес `/wikimapia/`; хосты тайловых слоёв в общем лимите — только те, что приложение шлёт через прокси (Strava, Tsvetkov).
- `ALLOWED_ORIGINS` прокси, хранилища треков и сервиса высот: вместо 8765, 8766 и 9876 — dev-сервер приложения 8769 и `vite preview` 4173, чтобы локально работали прокси, «Copy link» и профиль высот.
- Синтетика прода — без строк тайлов высот; документы и спеки — без тайлов высот, Wikimapia и karma.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `elevation-tiles`: удаляется целиком (все требования).
- `clone-hosting`: удаляется «Свои тайлы высот».
- `worker-limits`: «Частота запросов с одного IP» заменяется требованием без тайлов высот; «Ответ при превышении частоты», «Потолок ресурсов на вызов», «Только основной адрес Worker'а» — без тайлов.
- `cors-proxy`: «Формат адреса» без `/wikimapia/`; «Только разрешённые origin» заменяется требованием с dev-серверами приложения вместо karma; «Фильтрация заголовков» — сценарий без Wikimapia.
- `clone-monitoring`: синтетика без тайлов высот.

## Impact

- Код: `workers/elevation/` (`core/src/http.rs`, удаление `core/src/{archive,render,tile}.rs`, `core/tests/tiles.rs`, крейта `tiles/`, `fixtures/tiles/`, `test/tiles.test.js`, `scripts/elevation-tiles.sh`; `worker/src/lib.rs`, `wrangler.toml`, `vitest.config.js`, `test/limits.test.js`), `workers/cors-proxy/` (`src/index.js`, `wrangler.toml`, тесты), `workers/tracks/wrangler.toml` и тесты origin.
- CI: удаляется `.github/workflows/elevation-tiles.yml`; `scripts/prod-check.sh`.
- Документы: `AGENTS.md`, `docs/architecture/` (`elevation.md`, `cors-proxy.md`, `protection.md`, `decisions.md`, `README.md`), `openspec/backlog.md` (P2 про z10–11), ресёрч.
- Cloudflare: деплой трёх Worker'ов; счётчик `1001` освобождается. R2 не меняется без владельца.
