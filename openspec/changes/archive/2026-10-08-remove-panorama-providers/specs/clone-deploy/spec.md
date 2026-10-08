# Spec Delta

## MODIFIED Requirements

### Requirement: Сборка из шаблона секретов

Деплой SHALL собирать сайт с `src/secrets.js.template` и целью `NAKARTE_TARGET=clone`, без локальных секретов разработчика. Если в репозитории заведён секрет `GOOGLE_MAPS_API_KEY`, деплой SHALL подставлять его в поле `google` скопированного `src/secrets.js`; без секрета SHALL оставаться заглушка шаблона.

#### Scenario: Сборка в CI

- **WHEN** workflow собирает сайт
- **THEN** `src/secrets.js` скопирован из шаблона, а настройки клона берутся из `src/config-target/clone.js`

#### Scenario: Ключ Google заведён

- **WHEN** секрет `GOOGLE_MAPS_API_KEY` не пуст
- **THEN** Maps JavaScript API в собранном сайте загружается с этим ключом
