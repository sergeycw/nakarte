# Spec Delta

## ADDED Requirements

### Requirement: Свои данные перевалов и геокешинга

Клон SHALL загружать данные слоёв перевалов Вестры и geocaching.su у себя (capabilities `westra-passes-data`, `geocaching-su-data`), а не с `nakarte.me`.

#### Scenario: Слои данных в клоне

- **WHEN** пользователь клона включает слои перевалов и геокешинга
- **THEN** запросов к `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/` нет
