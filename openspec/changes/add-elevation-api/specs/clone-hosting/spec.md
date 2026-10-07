# Spec Delta

## ADDED Requirements

### Requirement: Свой сервис высот

Клон SHALL получать высоты для профиля, экспорта и внешних карт от своего сервиса высот (capability `elevation-api`), а не от `elevation.nakarte.me`.

#### Scenario: Профиль высот в клоне

- **WHEN** пользователь клона открывает профиль высот трека
- **THEN** запрос высот уходит на сервис клона, запросов к `elevation.nakarte.me` нет

### Requirement: Атрибуция Copernicus

Клон SHALL показывать атрибуцию Copernicus DEM, которой требует лицензия GLO-30: «© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved» и отказ от ответственности.

#### Scenario: Атрибуция в интерфейсе

- **WHEN** пользователь клона открывает профиль высот или раздел с атрибуциями
- **THEN** текст атрибуции Copernicus виден

## REMOVED Requirements

### Requirement: Авторский бэкенд высот

**Reason**: У клона свой сервис высот на Copernicus GLO-30.

**Migration**: Требование «Свой сервис высот».
