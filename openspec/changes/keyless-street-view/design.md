# Design

## Context

Мотивация — в `proposal.md`. Ключ попадает в `config.googleApiUrl` (`src/config.js`: `...&key=${secrets.google}`), его читает только `src/lib/googleMapsApi` для окна Street View; покрытие Street View — тайлы без ключа. Деплой копирует `src/secrets.js.template` и после `remove-panorama-providers` подставлял ключ из секрета, только если секрет есть.

Проверено 2026-10-08 в браузере: nakarte.me и локальный клон с пустым ключом ведут себя одинаково — панорама рисуется (WebGL-холст), консоль пишет «You are using this API without a key», поверх — водяной знак и закрываемое окно; с заглушкой `XXXX…` — «Oops! Something went wrong», панорамы нет.

## Goals / Non-Goals

**Goals:**
- Рабочее окно Street View в клоне без действий владельца и без оплаты.
- Свой ключ — по-прежнему только секретом, без правки кода.

**Non-Goals:**
- Убрать водяной знак и окно Google — только своим ключом.

## Decisions

### Пустой ключ в деплое, а не в config-target

Шаг деплоя пишет в `google` значение секрета, пустое без секрета. Альтернатива — `googleApiUrl` с `key=` в `src/config-target/clone.js` — перебила бы и подстановку ключа из секрета. Правка шаблона апстрима не нужна. Локальный `src/secrets.js` (вне git) тоже стоит держать с пустым `google`, чтобы окно открывалось на 8766.

## Risks / Trade-offs

- [Google официально требует ключ; режим без ключа помечен «For development purposes only» и может перестать работать] → тогда завести ключ: секрет `GOOGLE_MAPS_API_KEY` (инструкция и цена — `openspec/backlog.md`).
- [Водяной знак и окно с OK при каждой загрузке API] → так же у nakarte.me, решение владельца.

## Migration Plan

Merge → автодеплой. Откат — revert PR.
