# Spec Delta

## MODIFIED Requirements

### Requirement: Поделиться треком из панели редактирования

Пока линия трека редактируется, рядом с «Finish editing» SHALL быть кнопка «Share track» с меню «Save as GPX», «Save as GPX with elevation», «Send to device», «Save as KML», «Copy link for track». Пункты SHALL делать то же, что одноимённые пункты меню трека в списке, для редактируемого трека и SHALL NOT заканчивать редактирование.

#### Scenario: Экспорт из редактора

- **WHEN** линия трека «Kazbek» редактируется и пользователь выбирает «Save as GPX» в меню «Share track»
- **THEN** скачивается `Kazbek.gpx` с линией трека, опорные точки линии видны

#### Scenario: Send to device из редактора

- **WHEN** линия трека «Kazbek» редактируется и пользователь выбирает «Send to device» в меню «Share track»
- **THEN** открывается окно «Send to device» трека «Kazbek», линия остаётся в редактировании
