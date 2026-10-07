# Spec Delta

## ADDED Requirements

### Requirement: Панорамы клона

Сборка клона SHALL предлагать в панорамах только провайдеров, которых нет в `excludedPanoramaProviders` (`src/config-target/clone.js`): сейчас только Google Street View, без Wikimedia Commons, Mapillary и mapy.cz. Код скрытого провайдера в адресе (`n2=`, `n=`) SHALL не ломать загрузку карты и не включать провайдера. Сборка без цели SHALL показывать всех провайдеров как апстрим.

#### Scenario: Список панорам в клоне

- **WHEN** пользователь клона включает панорамы
- **THEN** в списке только «Google street view», запросов к `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` и `proxy.nakarte.me/mapy/` нет

#### Scenario: Ссылка со скрытым провайдером

- **WHEN** клон открыт по адресу с `n2=wmc`
- **THEN** карта открывается без ошибок, панорамы Wikimedia Commons, Mapillary и mapy.cz не включены

#### Scenario: Сборка апстрима

- **WHEN** приложение собрано без `NAKARTE_TARGET`
- **THEN** в панорамах Google street view, Wikimedia commons, Mapillary и mapy.cz, как в апстриме
