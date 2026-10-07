# Proposal

## Why

Панорамы в клоне берут данные у автора или у сервисов с ключом: покрытие Wikimedia Commons — `tiles.nakarte.me/wikimedia_commons_images`, покрытие Mapillary — `mapillary.nakarte.me`, mapy.cz — `proxy.nakarte.me/mapy/`. Mapillary без настоящего токена в клоне не работает уже сейчас (`mapillary4` в шаблоне секретов — заглушка). Change `add-photo-coverage-tiles` собирался генерировать покрытия сам; решение владельца 2026-10-07 — в клоне оставить в панорамах только Google Street View, а Wikimedia Commons, Mapillary и mapy.cz убрать. Ресёрч `add-photo-coverage-tiles` сохранён в `openspec/backlog.md`.

## What Changes

- Список `excludedPanoramaProviders` в `src/config-target/clone.js` (`wikimedia`, `mapillary`, `mapycz`), в `default.js` списка нет.
- Наследник `L.Control.Panoramas` с отфильтрованным `getProviders()` в `src/config-target/exclude-panoramas.js`, одна строка в `src/App.js`. Файлы контрола панорам не правятся.
- Тест karma на фильтр без сети.
- Change `add-photo-coverage-tiles` удалён, итоги ресёрча (Wikimedia, Mapillary) и пункт про Яндекс Панорамы — в бэклоге.

## Capabilities

### New Capabilities

### Modified Capabilities

- `clone-hosting`: в клоне панорамы только Google Street View, без запросов покрытия к `tiles.nakarte.me/wikimedia_commons_images`, `mapillary.nakarte.me` и `proxy.nakarte.me/mapy/`.

## Impact

- Изменения: `src/App.js` (вызов фильтра), `src/config-target/clone.js`, новый `src/config-target/exclude-panoramas.js`, новый тест `test/test_exclude_panoramas.js`.
- Сборка без цели (апстрим) ведёт себя как раньше.
- Окно Street View в клоне по-прежнему не открывается: ключ Google в сборке — заглушка (см. `design.md`, «Street View в клоне»).
