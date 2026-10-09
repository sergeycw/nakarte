# Tasks

## 1. Worker высот без тайлов

- [ ] 1.1 `core/src/http.rs` без маршрута `/tiles/`, `RateGroup::Tiles` и `tile_body`; удалить `archive.rs`, `render.rs`, `tile.rs`, `core/tests/tiles.rs`; тесты ядра — `/tiles/…` без `Origin` `403`, с разрешённым `405`, `rate_group` без тайлов; проверка: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo clippy -p elevation-worker --target wasm32-unknown-unknown -- -D warnings`, `cargo test --workspace` зелёные
- [ ] 1.2 Удалить крейт `tiles/` из воркспейса, `fixtures/tiles/`, `scripts/elevation-tiles.sh`, `.github/workflows/elevation-tiles.yml`; проверка: `cargo test --workspace` зелёный, `actionlint` по workflow
- [ ] 1.3 `worker/src/lib.rs` без `TILES_RATE_LIMITER` и `EncodeBody::Manual`; `wrangler.toml` без счётчика тайлов, `ALLOWED_ORIGINS` с 8769 и 4173; `vitest.config.js`, `test/tiles.test.js` (удалить), `test/limits.test.js`, `test/elevation.test.js`; проверка: `npm test` в `workers/elevation` зелёный

## 2. Прокси и хранилище треков

- [ ] 2.1 `workers/cors-proxy/src/index.js` без `PATH_ALIASES`, `LAYER_HOSTS` — Strava и Tsvetkov; `wrangler.toml` `ALLOWED_ORIGINS` с 8769 и 4173; тесты — `/wikimapia/…` `404`, origin 8769 и 4173 проходят, 9876 и 8765 — `403`, лимит слоёв на Tsvetkov; проверка: `npm test` в `workers/cors-proxy` и `npm run lint` из корня зелёные
- [ ] 2.2 `workers/tracks/wrangler.toml` `ALLOWED_ORIGINS` с 8769 и 4173, тест origin; комментарии `namespace_id` во всех `wrangler.toml`; проверка: `npm test` в `workers/tracks` зелёный

## 3. Синтетика и документы

- [ ] 3.1 `scripts/prod-check.sh` без тайлов высот; проверка: `sh -n`, прогон против прода после деплоя зелёный
- [ ] 3.2 `AGENTS.md` (сервис высот, ресурсы Cloudflare, подвох `ALLOWED_ORIGINS`), `docs/architecture/` (`elevation.md`, `cors-proxy.md`, `protection.md`, `decisions.md`, `README.md`, `ci-cd.md`), `openspec/backlog.md` (P2 про z10–11), ресёрч; проверка: скрипт ссылок — все файлы и разделы существуют
- [ ] 3.3 `openspec validate --all --strict`

## 4. Ревью, PR, прод

- [ ] 4.1 Независимое ревью диффа субагентом, исправления
- [ ] 4.2 PR в `master`, все проверки `pass` на последнем коммите, merge
- [ ] 4.3 После деплоя: `prod check`, проверки Migration Plan п. 3; итог — design, «Проверки»; шаг владельца с архивом R2 — в отчёт
- [ ] 4.4 Archive вторым PR, ссылки после archive, строка change в таблице «Changes по порядку» ресёрча
