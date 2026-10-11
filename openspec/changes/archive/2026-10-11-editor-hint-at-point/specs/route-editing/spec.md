## ADDED Requirements

### Requirement: Подсказка выбора на карте

Пока идёт выбор Join или Shortcut, на карте у точки, от которой он идёт (конец линии у Join, место у Shortcut), SHALL стоять подсказка, что кликнуть: `Click a track line to join it` или `Click the line where the shortcut ends`; в строке редактора подсказки SHALL NOT быть. Когда точка вне видимой части карты, подсказка SHALL оставаться видимой у края. Конец выбора SHALL убирать подсказку.

#### Scenario: Подсказка у конца линии

- **WHEN** пользователь выбирает Join у конца C, а потом нажимает Escape
- **THEN** пока идёт выбор, подсказка `Click a track line to join it` стоит на карте над C, а не в строке редактора; после Escape её нет

#### Scenario: Подсказка у места начала

- **WHEN** пользователь выбирает Shortcut у точки B и кликает по точке D
- **THEN** пока идёт выбор, подсказка `Click the line where the shortcut ends` стоит на карте над B; после среза её нет
