# Spec Delta

## ADDED Requirements

### Requirement: Свой сервис высот

Клон SHALL получать высоты для профиля, экспорта и внешних карт от своего сервиса высот (capability `elevation-api`), а не от `elevation.nakarte.me`.

#### Scenario: Профиль высот в клоне

- **WHEN** пользователь клона открывает профиль высот трека
- **THEN** запрос высот уходит на сервис клона, запросов к `elevation.nakarte.me` нет

### Requirement: Атрибуция данных высот

Клон SHALL показывать атрибуцию данных высот, которой требуют условия viewfinderpanoramas.org: упоминание «Elevation data: viewfinderpanoramas.org (Jonathan de Ferranti)» со ссылкой на страницу источника `https://viewfinderpanoramas.org/dem3.html`.

#### Scenario: Атрибуция в интерфейсе

- **WHEN** пользователь клона открывает профиль высот
- **THEN** атрибуция viewfinderpanoramas со ссылкой видна

## REMOVED Requirements

### Requirement: Авторский бэкенд высот

**Reason**: У клона свой сервис высот на Copernicus GLO-30.

**Migration**: Требование «Свой сервис высот».
