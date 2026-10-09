## MODIFIED Requirements

### Requirement: Свой сервис высот

Клон SHALL получать высоты для профиля и экспорта от своего сервиса высот (capability `elevation-api`), а не от `elevation.nakarte.me`.

#### Scenario: Профиль высот в клоне

- **WHEN** пользователь клона открывает профиль высот трека
- **THEN** запрос высот уходит на сервис клона, запросов к `elevation.nakarte.me` нет

### Requirement: Без слоёв mapy.cz

Приложение SHALL не содержать слоёв «mapy.cz tourist (Out of order)» (`Czt`) и «mapy.cz winter (Out of order)» (`Czw`): они шли через `proxy.nakarte.me/mapy/`, своего ключа mapy.cz нет. Поиск mapy.cz SHALL оставаться.

#### Scenario: Выбор слоёв

- **WHEN** пользователь открывает выбор слоёв
- **THEN** слоёв mapy.cz в нём нет, запросов к `proxy.nakarte.me/mapy/` нет
