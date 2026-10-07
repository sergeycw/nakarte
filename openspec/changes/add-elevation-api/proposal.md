# Proposal

## Why

Профиль высот, экспорт с высотами и внешние карты берут высоты с `elevation.nakarte.me` автора. Для автономии клона нужен свой сервис на тех же данных, что у автора: DEM 3″ с viewfinderpanoramas.org (проверено 2026-10-07: значения в узлах сетки совпадают с ответами автора до метра). Точность остаётся прежней (~90 м); переход на Copernicus GLO-30 (1″) — отдельный шаг в `openspec/backlog.md`. Решения и цифры — в `openspec/research/own-backends.md`.

## What Changes

- Утилита перепаковки HGT 3″ viewfinderpanoramas в компактные Int16-куски с индексом, загрузка результата в R2 вручную запускаемым workflow.
- Сервис высот на Rust в `workers/elevation/` (воркспейс `core`, `worker`, `server`, `repack`): `POST /` со строками `lat lng`, ответ построчно, контракт автора.
- Тесты ядра, контрактный тест против эталонов, снятых с сервиса автора, тест Worker в `workerd` с локальным R2; workflow `.github/workflows/check-elevation.yml`.
- Деплой Worker (Workers Paid), `elevationsServer` в `src/config-target/clone.js` на свой адрес.
- Атрибуция viewfinderpanoramas со ссылкой в интерфейсе клона.

## Capabilities

### New Capabilities

- `elevation-api`: высоты по списку точек — формат запроса и ответа, лимиты, отсутствие данных, интерполяция, CORS.

### Modified Capabilities

- `clone-hosting`: требование «Авторский бэкенд высот» (появляется в `add-track-storage`) заменяется своим сервисом высот и атрибуцией viewfinderpanoramas.

## Impact

- Новые файлы: `workers/elevation/` (Rust-воркспейс, `wrangler.toml`, тесты), `.github/workflows/check-elevation.yml`, `.github/workflows/elevation-data.yml`, фикстуры эталонов.
- Изменения: `src/config-target/clone.js`, `.github/workflows/deploy-pages.yml`, атрибуция в UI клона.
- Данные: 16.6 ГБ zip с HGT, перепаковка в GitHub Actions, результат — в бакет R2 `nakarte-elevation`.
- Cloudflare: Workers Paid включает владелец.
- Зависимость по архиву: архивировать после `add-track-storage`.
