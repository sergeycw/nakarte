# Proposal

## Why

Окно Google Street View в клоне падает: Maps JavaScript API грузится с ключом-заглушкой из `src/secrets.js.template`, и Google отвечает ошибкой ключа. На nakarte.me ключ пустой (`google:""` в бандле, проверено 2026-10-08): API работает в режиме без ключа, панорама открывается с водяным знаком «For development purposes only» и окном «This page can't load Google Maps correctly» с кнопкой OK. Решение владельца 2026-10-08 — так же, без ключа и без оплаты; свой ключ остаётся возможным через секрет.

## What Changes

- Шаг `google maps key` в `.github/workflows/deploy-pages.yml` всегда записывает в поле `google` значение секрета `GOOGLE_MAPS_API_KEY`: без секрета — пустую строку вместо заглушки.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-deploy`: «Сборка из шаблона секретов» — без секрета ключ Google пустой, а не заглушка.

## Impact

- `.github/workflows/deploy-pages.yml`; шаблон секретов апстрима не меняется.
