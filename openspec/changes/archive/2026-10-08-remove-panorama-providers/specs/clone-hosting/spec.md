# Spec Delta

## REMOVED Requirements

### Requirement: Панорамы клона

**Reason**: провайдеры Wikimedia Commons, Mapillary и mapy.cz удалены из кода, список `excludedPanoramaProviders` и разница со сборкой апстрима больше не нужны.

**Migration**: требование «Только Google Street View в панорамах».

## ADDED Requirements

### Requirement: Только Google Street View в панорамах

Приложение SHALL предлагать в панорамах только Google Street View: провайдеров Wikimedia Commons, Mapillary и mapy.cz в коде нет. Код удалённого провайдера в адресе (`n2=`, `n=`) SHALL не ломать загрузку карты и ничего не включать.

#### Scenario: Список панорам в клоне

- **WHEN** пользователь клона включает панорамы
- **THEN** в списке только «Google street view», запросов к `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` и `proxy.nakarte.me/mapy/` нет

#### Scenario: Ссылка с удалённым провайдером

- **WHEN** клон открыт по адресу с `n2=wmc`
- **THEN** карта открывается без ошибок, панорамы не включены
