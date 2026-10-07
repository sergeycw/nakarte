# Spec Delta

## ADDED Requirements

### Requirement: Свои тайлы покрытия фотографий

Клон SHALL брать тайлы покрытия Wikimedia Commons и Mapillary у себя (capability `photo-coverage-tiles`), а не с `tiles.nakarte.me` и `mapillary.nakarte.me`.

#### Scenario: Панорамы в клоне

- **WHEN** пользователь клона включает панорамы Wikimedia и Mapillary
- **THEN** запросов к `tiles.nakarte.me/wikimedia_commons_images` и `mapillary.nakarte.me` нет
