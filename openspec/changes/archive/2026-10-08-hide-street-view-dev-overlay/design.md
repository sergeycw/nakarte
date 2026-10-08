# Design

## Context

Мотивация — в `proposal.md`. Режим без ключа Google (проверено 2026-10-08 на nakarte.me в рабочем Chrome и на клоне 8766): холсту сцены `canvas.mapsImagerySceneScene__canvas` Google ставит инлайновый `filter: invert(1)`; водяной знак — `div` внутри `.gm-style` с инлайновыми `z-index: 1000; font-size: 20px`; окно ошибки — следующий за `.gm-style` элемент контейнера, появляется не при каждой загрузке. Авторизация (`AuthenticationService.Authenticate` отвечает `[1,…]`) и загрузчик `maps/api/js?v=3&key=` для nakarte.me и нашего домена одинаковые — особого доступа у автора нет, всё делает CSS.

Правила nakarte.me (боевой `app.css`, сборка `master-31867c1-dirty`):
- `div[aria-label="Street View"] { filter: invert(1) !important; }` — вторая инверсия на корне сцены;
- `.panorama-container > div.gm-style + div { z-index: -1 !important; }` — окно уходит под панораму;
- `.panorama-container > div.gm-style > div:nth-child(2) > div:first-child > div:nth-child(9) > div:first-child { opacity: 0; }` — водяной знак.

## Goals / Non-Goals

**Goals:**
- Панорама без ключа выглядит как на nakarte.me.
- С настоящим ключом ничего не меняется.

**Non-Goals:**
- Свой ключ Google (остаётся секретом `GOOGLE_MAPS_API_KEY`, пункт в бэклоге).

## Decisions

### Правила только под классом режима без ключа

У nakarte.me правила глобальные: ключа у них нет никогда. У нас ключ может появиться из секрета, и тогда вторая инверсия сделала бы чистую панораму негативом. Поэтому `markKeylessContainer` ставит класс `google-street-view-keyless`, только если в `config.googleApiUrl` пустой `key=`, и все правила висят под ним.

### Селекторы

Инверсия — как у автора, по `aria-label="Street View"`. Водяной знак — по инлайновым стилям (`z-index: 1000` и `font-size: 20px` внутри `.gm-style`), а не по позиции `nth-child(9)`: позиция ломается от любого нового слоя Google. Окно — `display: none` вместо `z-index: -1`: под панорамой оно всё равно не нужно.

### Тест

Karma: `isGoogleKeyless` на адресах с пустым, непустым ключом и без параметра; контейнер с разметкой, повторяющей Google, при пустом ключе получает инверсию на корне и скрытые знак и окно, при ключе — нет. Совпадение с настоящей вёрсткой Google проверяется только в браузере.

## Risks / Trade-offs

- [Условия Google Maps Platform] → режим без ключа и скрытие уведомлений Google противоречат [условиям](https://cloud.google.com/maps-platform/terms) («Customer will not modify, obscure, or delete such attribution»). Решение владельца: клон личный и некоммерческий, как nakarte.me. Если нужна чистая и законная панорама — свой ключ (бесплатно 5 000 панорам в месяц).
- [Google поменяет вёрстку или закроет режим без ключа] → правила перестанут прятать знак или окно не откроется; тогда — ключ через секрет.

## Migration Plan

Merge → автодеплой. Откат — revert PR.
