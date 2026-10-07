# Proposal

## Why

В бакете `nakarte-tiles` лежат только тайлы Грузии (`E40_N40`, `E45_N40`), поэтому клон строит маршрут только там. Код синхронизации готов, но всемирный прогон ещё не запускался.

## What Changes

- Один ручной прогон workflow «brouter tiles sync» без `only`: в R2 заливаются все тайлы brouter.de (1142 тайла, ≈ 10 ГБ).
- Дальше тайлы обновляются еженедельным прогоном по расписанию.
- Код не меняется.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: добавляется требование о покрытии — клон строит маршрут везде, где у brouter.de есть тайлы, а не только в Грузии.

## Impact

- R2 `nakarte-tiles`: ≈ 10 ГБ хранения, около 1142 записей за прогон и по ~1142 на каждый еженедельный прогон, если brouter.de обновил тайлы.
- GitHub Actions: прогон до нескольких часов (лимит задания 300 минут).
- Зависит от `add-pages-autodeploy` только общими секретами `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID` и тем, что workflow должен быть в `master`.
