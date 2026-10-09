## ADDED Requirements

### Requirement: Данные движка от корня origin

Код движка, профили и тайлы SHALL читаться с origin страницы через HTTP Range-запросы. Каталог тайлов задаётся `routingTilesPath`. Пути движка SHALL отсчитываться от корня origin, а не от пути страницы.

#### Scenario: Чтение тайла

- **WHEN** движок считает маршрут в районе тайла `E40_N40`
- **THEN** он делает Range-запросы к `<routingTilesPath>E40_N40.rd5` на origin страницы, а не скачивает файл целиком

#### Scenario: Приложение и стенд

- **WHEN** движок запускают приложение на `/` или стенд `/engine-bench.html`
- **THEN** код и профили движка читаются из `/brouter-wasm/`, тайлы — из `<routingTilesPath>` от корня origin

## REMOVED Requirements

### Requirement: Данные движка с того же origin

**Reason**: Сценарий «Страница на /next/» описывал приложение на `/next/`; приложение переехало на `/`.

**Migration**: Требование «Данные движка от корня origin» с тем же поведением и сценарием для приложения на `/` и стенда.
