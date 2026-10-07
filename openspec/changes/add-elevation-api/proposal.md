# Proposal

## Why

Профиль высот, экспорт с высотами и внешние карты берут высоты с `elevation.nakarte.me` автора: сетка 3″ (~90 м), сглаживающая гребни и перевалы. Для автономии клона нужен свой сервис, и он же даёт точность 1″ (~30 м) на Copernicus GLO-30. Решения и цифры — в `openspec/research/own-backends.md`.

## What Changes

- Утилита перепаковки Copernicus GLO-30 (релиз 2024_1) в компактные Int16-куски с индексом, загрузка результата в R2.
- Сервис высот на Rust в `workers/elevation/` (воркспейс `core`, `worker`, `server`, `repack`): `POST /` со строками `lat lng`, ответ построчно, контракт автора.
- Тесты ядра и контрактный тест против эталонов, снятых с сервиса автора; workflow `.github/workflows/check-elevation.yml`.
- Деплой Worker (Workers Paid), `elevationsServer` в `src/config-target/clone.js` на свой адрес.
- Атрибуция Copernicus в интерфейсе клона.

## Capabilities

### New Capabilities

- `elevation-api`: высоты по списку точек — формат запроса и ответа, лимиты, отсутствие данных, точность и интерполяция, CORS.

### Modified Capabilities

- `clone-hosting`: требование «Авторский бэкенд высот» (появляется в `add-track-storage`) заменяется своим сервисом высот и атрибуцией Copernicus.

## Impact

- Новые файлы: `workers/elevation/` (Rust-воркспейс, `wrangler.toml`), `.github/workflows/check-elevation.yml`, фикстуры эталонов.
- Изменения: `src/config-target/clone.js`, `.github/workflows/deploy-pages.yml`, атрибуция в UI клона.
- Данные: GLO-30 скачивается и перепаковывается вне CI (сотни ГБ), результат — в бакет R2.
- Cloudflare: Workers Paid включает владелец; бакет R2 под данные высот.
- Зависимость по архиву: архивировать после `add-track-storage`.
