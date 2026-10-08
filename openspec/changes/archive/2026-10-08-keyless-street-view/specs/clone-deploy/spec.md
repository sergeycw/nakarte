# Spec Delta

## MODIFIED Requirements

### Requirement: Сборка из шаблона секретов

Деплой SHALL собирать сайт с `src/secrets.js.template` и целью `NAKARTE_TARGET=clone`, без локальных секретов разработчика. Поле `google` скопированного `src/secrets.js` SHALL получать значение секрета `GOOGLE_MAPS_API_KEY`, а без секрета — пустую строку: Maps JavaScript API тогда работает в режиме без ключа, как на nakarte.me.

#### Scenario: Сборка в CI

- **WHEN** workflow собирает сайт
- **THEN** `src/secrets.js` скопирован из шаблона, а настройки клона берутся из `src/config-target/clone.js`

#### Scenario: Ключ Google заведён

- **WHEN** секрет `GOOGLE_MAPS_API_KEY` не пуст
- **THEN** Maps JavaScript API в собранном сайте загружается с этим ключом

#### Scenario: Без ключа Google

- **WHEN** секрета `GOOGLE_MAPS_API_KEY` нет
- **THEN** Maps JavaScript API загружается с пустым ключом, окно Street View показывает панораму с водяным знаком Google
