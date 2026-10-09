## MODIFIED Requirements

### Requirement: Выбор переживает перезагрузку

Приложение SHALL сохранять последний выбор слоёв и настройки списка в `localStorage` под своими ключами, не трогая `leafletLayersSettings` старого клиента, и SHALL применять сохранённый выбор при открытии без годного `l=`.

#### Scenario: Перезагрузка без l=

- **WHEN** пользователь включил подложку «ESRI Satellite» и оверлей «Relief shading», затем открыл `/` без параметров
- **THEN** включены ESRI Satellite и Relief shading
