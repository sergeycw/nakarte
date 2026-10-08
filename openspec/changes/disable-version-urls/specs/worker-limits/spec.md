## ADDED Requirements

### Requirement: Только основной адрес Worker'а

Worker'ы клона SHALL отвечать только по основному адресу `<worker>.nakarte-routing.workers.dev`. Version URL (`<версия>-<worker>.nakarte-routing.workers.dev`) и их алиасы SHALL быть выключены для всех версий: иначе старая версия со старыми лимитами обходит лимиты новой.

#### Scenario: Запрос к старой версии

- **WHEN** клиент запрашивает `https://887323ef-nakarte-elevation.nakarte-routing.workers.dev/tiles/0/0/0`
- **THEN** код старой версии не выполняется, ответ не `200`

#### Scenario: Основной адрес

- **WHEN** клиент запрашивает `https://nakarte-elevation.nakarte-routing.workers.dev/tiles/0/0/0`
- **THEN** отвечает текущая версия, как раньше
