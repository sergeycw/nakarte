# Design

## Context

Ручной деплой описан в `AGENTS.md` («Сборка и деплой клона вручную»). Файлы движка не лежат в git: их достаёт из образа BRouter и компилирует `experiments/wasm/cheerpj/build.sh`, а webpack копирует их в `build/brouter-wasm/` с `noErrorOnMissing`. Поэтому сборка без них проходит молча.

## Goals / Non-Goals

**Goals:**
- Повторить ручной деплой в CI без доступа к локальному контейнеру `nakarte-brouter`.
- Не дать выкатить сборку без движка.

**Non-Goals:**
- Preview-деплои для PR.
- Ждать зелёных тестов `check` перед деплоем: они зависят от внешних сервисов импорта треков и к клону не относятся.
- Синхронизация тайлов: отдельный workflow, см. change `sync-world-tiles`.

## Decisions

- **`docker create` вместо `docker run`.** `build.sh` только копирует файлы через `docker cp`, контейнеру не нужно работать. Так же проверено локально на временном контейнере.
- **Образ `nightly`.** У `latest` нет arm64, а локальная разработка идёт на `nightly`; в CI тот же тег, чтобы jar совпадал с локальным. Манифест образа содержит и amd64.
- **JDK 17 из `actions/setup-java`.** `build.sh` компилирует с `--release 11`, любой JDK ≥ 11 подходит.
- **`npx --yes wrangler@4`.** Как в ручном деплое и в синхронизации тайлов, без wrangler в `devDependencies`, чтобы не трогать `package.json` апстрима.
- **Явная проверка файлов движка** шагом `test -f` после сборки вместо смены `noErrorOnMissing`: локальная сборка без контейнера должна работать как раньше.
- **`concurrency` с `cancel-in-progress`.** Публикация Pages атомарна, отмена старого прогона безопасна.

## Risks / Trade-offs

- [`nightly` сменит `lookups.dat` или формат профилей] → тайлы с brouter.de и профили образа разойдутся. Синхронизация тайлов сверяет `lookups.dat` только с brouter.de. Смягчение: при сбоях маршрутов сравнить `lookups.dat` образа и brouter.de; закрепить digest образа — кандидат в бэклог.
- [Токен с правами шире нужного] → токен создаётся на один аккаунт с правами Pages Edit, Workers Scripts Edit, Workers R2 Storage Edit.
- [Деплой прокси на каждый push] → лишний `wrangler deploy`, но worker маленький и идемпотентный.

## Migration Plan

1. Владелец заводит секреты `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.
2. Workflow попадает в `master` вместе с PR.
3. Первый прогон проверяется через `gh run list --workflow deploy-pages.yml`.

Откат: [Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/) Pages на прошлый production-деплой, `wrangler rollback` для прокси, или ручной деплой из `AGENTS.md`.
