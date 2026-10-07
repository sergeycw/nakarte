# Tasks

## 1. Движок

- [x] 1.1 Патч `OsmNodesMap`: ловить `ArithmeticException` вместе с `StackOverflowError`; проверка: `javap` патча и класса из jar совпадают, кроме записи в таблице исключений
- [x] 1.2 `build.sh` собирает все файлы из `patch/`; проверка: в `lib/brouter-patch.jar` есть `NodesCache.class` и `OsmNodesMap.class`
- [x] 1.3 `WasmRouter` отдаёт «no route found» на пустой трек; проверка: сборка `build.sh` проходит
- [x] 1.4 Берлин на локальном клоне совпадает с серверным BRouter того же образа на том же тайле; проверка: 4 маршрута (`mtb`, `hiking-mountain`, `trekking`, длинный `mtb`) — 2691, 2873, 2941, 12994 м в обоих
- [x] 1.5 Подвох CheerpJ записан в `AGENTS.md`; проверка: `openspec validate --all --strict`

## 2. Прод

- [ ] 2.1 После деплоя Москва, Париж и Берлин на `https://nakarte-routing.pages.dev` строятся; проверка: движок на проде даёт ненулевую длину

## Workflow follow-up

- Архивировать change: `openspec archive fix-dense-area-routing --yes`.
