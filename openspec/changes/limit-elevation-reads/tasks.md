# Tasks

## 1. Ядро

- [ ] 1.1 `core`: `read_count` (градусы + куски), `MAX_READS = 512` и `413` до чтения, трейт `ReadBudget` и `429` при отказе бюджета в `http::handle`; проверка: `cargo test --workspace` — тесты на 600 градусов (`413`, источник не читается), на трек 2 000 км (`200`), на отказ бюджета (`429` с CORS), на запрос без чтений (бюджет не тратится)
- [ ] 1.2 `server`: бюджет без ограничения; проверка: `cargo test --workspace`, `cargo clippy --workspace` и под wasm32 — `-p elevation-worker`

## 2. Worker

- [ ] 2.1 `worker`: `ReadBudget` поверх `API_READS_RATE_LIMITER`, `ceil(reads / 64)` вызовов `limit()`, без `CF-Connecting-IP` — без ограничения; `wrangler.toml`: `[[ratelimits]]` 1005 (32 за 60 с), `[limits] subrequests = 1100`; проверка: тест в `workerd` с пониженным бюджетом — `429` после бюджета, `413` на точки вразброс, `check-elevation.yml` зелёный

## 3. Документация и прод

- [ ] 3.1 `docs/architecture/protection.md` (таблица, порядок проверок), `docs/architecture/elevation.md`; проверка: ссылки существуют, `openspec validate --all --strict`
- [ ] 3.2 После деплоя: `scripts/prod-check.sh` зелёный, один запрос на 600 точек вразброс получает `413`; проверка: `curl` с прода
