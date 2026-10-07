# Design

## Context

Мотивация — в `proposal.md`. Контрол панорам — `src/lib/leaflet.control.panoramas/index.js`: `getProviders()` возвращает четыре провайдера (`google`, `wikimedia`, `mapillary`, `mapycz`, коды в адресе `g`, `w`, `m`, `c`), `initialize()` сохраняет их в `this.providers` и создаёт по контейнеру на каждого. Дальше всё — список чекбоксов, слои покрытия, поиск по клику, `serializeState`/`unserializeState` для адреса `n2=` и старого `n=` — перебирает только `this.providers`. Покрытие провайдера запрашивается, только когда он отмечен и панорамы включены.

## Goals / Non-Goals

**Goals:**
- В клоне в панорамах только Google Street View, без правки файлов контрола панорам.
- Тот же приём, что у слоёв (`hide-map-data-layers`): список в config-target и фильтр в каталоге только форка.

**Non-Goals:**
- Свои тайлы покрытия Wikimedia Commons и Mapillary (бывший `add-photo-coverage-tiles`) — в бэклоге.
- Ключ Google для окна Street View — действие владельца.
- Удаление модулей провайдеров из бандла.

## Decisions

### Наследник контрола вместо фильтра после создания

`excludePanoramaProviders(PanoramasControl, names)` возвращает `PanoramasControl.extend({getProviders})`, где список базового класса фильтруется по `name`; без списка возвращается сам класс. Фильтр после `new L.Control.Panoramas()` оставил бы контейнеры и подписки скрытых провайдеров, созданные в `initialize()`. В `src/App.js` меняется одна строка конструктора и добавляется импорт. Фильтр по `name`, а не по коду в адресе: имя понятнее в `clone.js`, коды однобуквенные.

### Адрес со скрытым провайдером

`unserializeState` ставит `selected` по кодам среди `this.providers` и открывает панораму, только если её код нашёлся там же, поэтому `n2=w` или `n2=_c/c/...` в клоне просто ничего не включают. `hashStateUpgrader` переводит старый `n=` в тот же формат. Проверяется в браузере.

### Street View в клоне

Проверено 2026-10-07 на `https://nakarte-routing.pages.dev`: покрытие Street View рисуется (тайлы `maps.googleapis.com/maps/vt?...svv` без ключа), панорама по клику находится, но окно показывает «This page didn't load Google Maps correctly»: Maps JavaScript API загружается с ключом-заглушкой из `src/secrets.js.template`. Нужен ключ владельца с Maps JavaScript API, ограниченный по HTTP referrer `nakarte-routing.pages.dev`, и подстановка его в сборку клона в CI. Цена по [прайсу Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing): Dynamic Street View — SKU Pro, 5 000 бесплатных событий в месяц, дальше $14 за 1 000; Street View Metadata — без ограничений бесплатно. Пункт — в `openspec/backlog.md`.

## Risks / Trade-offs

- [Пользователь клона теряет Wikimedia Commons, Mapillary и mapy.cz] → решение владельца; вернуть — убрать имя из списка и дать провайдеру данные (`openspec/backlog.md`).
- [Единственный провайдер в клоне без ключа не открывает окно] → покрытие всё равно полезно, ключ — в бэклоге.
- [При ребейзе апстрим поменяет `getProviders()` или поле `name`] → тест karma проверяет фильтр на заглушке контрола, а не на настоящем `L.Control.Panoramas`: импорт контрола тянет в бандл теста `mapillary-js` без транспиляции (в режиме testing babel пропускает `node_modules`), и прогон в Firefox 52 ESR падает с `SyntaxError: invalid property id`. Имена провайдеров после ребейза сверять вручную, в браузере на 8766.

## Migration Plan

Merge → автодеплой клона. Откат — убрать `excludedPanoramaProviders` из `clone.js`.
