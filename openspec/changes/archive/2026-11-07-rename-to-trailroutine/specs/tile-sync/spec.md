# Spec Delta

## MODIFIED Requirements

### Requirement: Запуск по расписанию и вручную

Синхронизация SHALL запускаться в GitHub Actions каждый понедельник в 04:00 UTC и вручную с необязательным списком тайлов `only`, только в репозитории `sergeycw/trailroutine`. Локальный запуск без `R2_MODE=remote` SHALL писать в локальный R2 wrangler.

#### Scenario: Ручной запуск

- **WHEN** workflow «brouter tiles sync» запущен вручную с `only=E40_N40`
- **THEN** синхронизируется только `E40_N40`

#### Scenario: Форк форка

- **WHEN** workflow срабатывает в другом репозитории
- **THEN** задание пропускается
