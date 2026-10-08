# Tasks

## 1. Панорама без ключа

- [x] 1.1 `lib/google/keyless.css` и `keyless.js`, вызов `markKeylessContainer` в окне Street View; проверка: тест karma `test/test_google_keyless.js` зелёный в `main.yml`, линт чистый
- [x] 1.2 В браузере на локальном клоне (8766, `google: ''`): панорама в нормальных цветах, водяного знака нет; проверка: две инверсии (`invert(1)` на корне и холсте), знак скрыт, скриншот

## 2. Прод

- [x] 2.1 На `https://nakarte-routing.pages.dev` окно Street View без водяного знака и негатива; проверка: две инверсии, знак скрыт

## Workflow follow-up

- Архивировать: `openspec archive hide-street-view-dev-overlay --yes`.
