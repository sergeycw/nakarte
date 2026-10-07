# Spec Delta

## ADDED Requirements

### Requirement: Скрытые слои клона

Сборка клона SHALL не предлагать слои, коды которых перечислены в `excludedLayerCodes` (`src/config-target/clone.js`): их нет в выборе слоёв, они не включаются хоткеями и не восстанавливаются из адреса, а код такого слоя в адресе не ломает загрузку карты. Сборка без цели SHALL показывать все слои как апстрим.

#### Scenario: Ссылка со скрытым слоем

- **WHEN** клон открыт по адресу с `l=O/Wp`
- **THEN** карта открывается со слоем OpenStreetMap без ошибок, слой перевалов не включён

#### Scenario: Сборка апстрима

- **WHEN** приложение собрано без `NAKARTE_TARGET`
- **THEN** все слои из `src/layers.js` доступны, как в апстриме

### Requirement: Без слоёв данных автора

Сборка клона SHALL не показывать слои «Mountain passes (Westra)» (`Wp`) и «geocaching.su» (`Gc`): их данные лежат только на `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/`.

#### Scenario: Выбор слоёв в клоне

- **WHEN** пользователь клона открывает выбор слоёв
- **THEN** в нём нет «Mountain passes (Westra)» и «geocaching.su», запросов к `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/` нет
