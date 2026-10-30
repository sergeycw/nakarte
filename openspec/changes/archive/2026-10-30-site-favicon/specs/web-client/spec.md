## ADDED Requirements

### Requirement: Иконка сайта

Страница SHALL объявлять иконку сайта: SVG (`/favicon.svg`), ICO с картинками 16, 32 и 48 px (`/favicon.ico`) и иконку для экрана iPhone 180 px (`/apple-touch-icon.png`). Все три SHALL отдаваться сайтом.

#### Scenario: Иконка сайта

- **WHEN** пользователь открывает `/`
- **THEN** в странице есть ссылки на `/favicon.svg`, `/favicon.ico` и `/apple-touch-icon.png`, и сайт отдаёт их с кодом `200` и типом картинки
