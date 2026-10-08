# Proposal

## Why

После `keyless-street-view` окно Street View в клоне открывается без ключа, но в режиме разработки Google: панорама негативом, водяной знак «For development purposes only» и окно «This page can't load Google Maps correctly». nakarte.me работает в том же режиме, но прячет его тремя правилами в боевом `app.css` (в репозитории автора их нет). Решение владельца 2026-10-08: сделать так же — клон личный и некоммерческий, платный ключ не нужен.

## What Changes

- `src/lib/leaflet.control.panoramas/lib/google/keyless.css` и `keyless.js`: при пустом ключе в `config.googleApiUrl` контейнер панорамы получает класс `google-street-view-keyless`, под которым вторая инверсия возвращает цвета, а водяной знак и окно Google скрыты.
- Одна строка в `lib/google/index.js` (вызов в конструкторе окна) и импорт.
- Тест karma: определение режима без ключа и применение правил к разметке, похожей на Google.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: окно Street View без ключа показывает панораму без водяного знака и окна Google.

## Impact

- Новые файлы в `lib/google/`, правка `lib/google/index.js`, тест `test/test_google_keyless.js`.
- С настоящим ключом (секрет `GOOGLE_MAPS_API_KEY`) правила не включаются.
