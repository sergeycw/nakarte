# Spec Delta

## ADDED Requirements

### Requirement: Свои тайлы высот

Клон SHALL брать тайлы высот для показа высоты под курсором у себя (capability `elevation-tiles`), а не с `tiles.nakarte.me/elevation`.

#### Scenario: Высота под курсором в клоне

- **WHEN** пользователь клона водит курсором по карте с включённым показом высоты
- **THEN** тайлы высот запрашиваются у клона, запросов к `tiles.nakarte.me/elevation` нет
