# Design

## Context

Мотивация — в `proposal.md`. Слои описаны в `src/layers.js` (`layersDefs`, `groupsDefs`, `titlesByOrder`); `getLayers()` раскладывает их по группам и передаётся в `enableLayersConfig` в `src/App.js`. Change `hide-map-data-layers` (архив 2026-10-07) спрятал `Wp` и `Gc` в клоне фильтром `excludeLayers()` из `src/config-target/exclude-layers.js`; первая версия этого change дописывала туда же 17 кодов сканов. После решения владельца 2026-10-08 (свой продукт, апстрим — справочник) путь «прятать в `config-target`» отменён: неиспользуемый код удаляется.

### Где встречаются коды и названия слоёв

Поиск по кодам, названиям, `shortName` и адресам тайлов (`grep` по `src`, `test`, `webpack`, `scripts`, `.github`, `functions`):

| Место | Что там | Что делаем |
|---|---|---|
| `src/layers.js`, `layersDefs` | определения 19 слоёв | удалить |
| `src/layers.js`, `groupsDefs` | названия в группах «Default layers», «Topo maps», «Miscellaneous» | удалить названия; группы не пустеют («Miscellaneous» остаётся с «Google Hybrid») |
| `src/layers.js`, `titlesByOrder` | порядок слоёв | удалить названия |
| `src/layers.js`, импорты | `~/lib/leaflet.layer.westraPasses`, `GeocachingSu` | удалить |
| `src/lib/leaflet.layer.westraPasses/`, `src/lib/leaflet.layer.geocaching-su/` | код слоёв, CSS, иконки | удалить каталоги |
| `src/lib/leaflet.layer.rasterize/WestraPasses.js`, `index.js` | печать слоя перевалов | удалить файл и импорт |
| `src/lib/leaflet.layer.geojson-ajax/` | используется только слоем перевалов | удалить |
| `src/config.js` | `westraDataBaseUrl`, `geocachingSuUrl` | удалить |
| `src/config-target/clone.js`, `exclude-layers.js`, `src/App.js`, `test/test_exclude_layers.js` | фильтр `excludedLayerCodes` | удалить механизм, вызов в `App.js` — как в апстриме |
| `leaflet.control.layers.hotkeys`, `leaflet.control.layers.configure` | хоткеи по однобуквенному коду, настройки в `localStorage` по коду, восстановление из адреса | без правок: работают только с переданными в контрол слоями |
| `leaflet.hashState/Leaflet.Control.Layers.js` | адрес `l=` | без правок: ищет коды среди слоёв контрола |
| `leaflet.control.printPages`, `leaflet.control.jnx` | печать и JNX по флагам `print`, `jnx`, `shortName` слоя | без правок: жёстких кодов и названий нет |
| `test/test_layers.js` | проверки целостности определений | без правок, остаётся зелёным |

Других упоминаний нет: ни печать, ни JNX, ни внешние карты, ни поиск не ссылаются на коды или названия удаляемых слоёв.

## Goals / Non-Goals

**Goals:**
- Ни в одной сборке нет слоёв на тайлах `tiles.nakarte.me` и данных `nakarte.me/westraPasses/`, `nakarte.me/geocachingSu/`.
- Старые ссылки и сохранённые настройки со снятыми кодами открываются без ошибок.

**Non-Goals:**
- Замена удалённых слоёв другими (свои данные перевалов и геокешинга — бэклог).
- Слои mapy.cz через `proxy.nakarte.me/mapy/` — change `drop-author-services`.

## Decisions

### Удалить, а не прятать

Владелец 2026-10-08 снял правило «дифф с апстримом держим маленьким», поэтому определения слоёв, их код и ключи конфига удаляются. После удаления `Wp` и `Gc` список `excludedLayerCodes` пуст, и фильтр `hide-map-data-layers` не нужен: `exclude-layers.js`, его тест и ключ удаляются, строка в `src/App.js` возвращается к апстриму. Код слоёв перевалов и геокешинга при надобности возвращается из истории git или из `upstream/master`.

Хоткеи удалённых однобуквенных слоёв (T, D, N, A, J, C, F, B, K, U, R) освобождаются; другим слоям их не переназначаем.

### Старые коды в адресе и настройках

`unserializeState` контрола слоёв (`leaflet.hashState/Leaflet.Control.Layers.js` и переопределение в `leaflet.control.layers.configure`) ищет коды только среди слоёв контрола: неизвестный код игнорируется, а если в адресе не осталось базового слоя, метод возвращает `false`, и карта открывается со слоем по умолчанию. `loadSettings` перебирает известные слои и берёт настройки по их кодам, лишние записи не применяет, а `saveSettings` пишет только известные слои — записи удалённых пропадают при первом сохранении. Код не меняется; поведение закрепляет тест karma, который поднимает контрол слоёв на карте без `setView` (без вида тайлы не грузятся, сети в тесте нет).

## Risks / Trade-offs

- [Пользователи теряют слои сканов, перевалов и геокешинга] → решение владельца; свои данные — бэклог.
- [Перенос правок автора в удалённые файлы] → конфликт modify/delete, решать удалением.

## Migration Plan

Merge → автодеплой клона. Откат — revert PR.
