# Proposal

## Why

Покрытие панорам Wikimedia Commons и Mapillary в клоне рисуется тайлами автора (`tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me`), которые он генерирует у себя. Для автономии клону нужны свои тайлы покрытия в тех же форматах.

## What Changes

- Пайплайн покрытия Wikimedia Commons: геотеги фотографий → растровые тайлы z0–10 и бинарные тайлы точек z11 в формате клиента.
- Пайплайн покрытия Mapillary: данные покрытия Mapillary → растровые тайлы 1024 px в формате клиента; API-токен Mapillary заводит владелец.
- Хранение и раздача тайлов из R2, регулярное обновление.
- Тесты кодирования тайлов и раздачи без сети, workflow `.github/workflows/check-coverage.yml`.
- `wikimediaCommonsCoverageUrl` и `mapillaryRasterTilesUrl` в `src/config-target/clone.js`.

## Capabilities

### New Capabilities

- `photo-coverage-tiles`: тайлы покрытия фотографий Wikimedia Commons и Mapillary для панорам — форматы, зумы, обновление, раздача.

### Modified Capabilities

- `clone-hosting`: клон берёт тайлы покрытия у себя.

## Impact

- Новые файлы: каталог сервиса в `workers/` (код генерации и раздачи, тесты, фикстуры), `.github/workflows/check-coverage.yml`.
- Изменения: `src/config-target/clone.js`, `.github/workflows/deploy-pages.yml`.
- Внешнее: API Wikimedia Commons или дампы геотегов, API Mapillary с токеном владельца.
