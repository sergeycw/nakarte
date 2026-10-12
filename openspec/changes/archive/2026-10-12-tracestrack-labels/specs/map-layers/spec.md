## MODIFIED Requirements

### Requirement: Слои через прокси

Слои Strava heatmap (`Sa`, `Sr`, `Sb`, `Sw`), Mountains by Aleksey Tsvetkov (`Mt`) и Tracestrack Topo (`Tt`) SHALL загружаться через CORS-прокси клона; остальные слои каталога SHALL загружаться напрямую с серверов провайдеров. Адреса тайлов Tracestrack в приложении SHALL NOT содержать ключ API.

#### Scenario: Слой Strava

- **WHEN** пользователь включает «Strava heatmap (all)»
- **THEN** тайлы запрашиваются у `nakarte-cors-proxy.nakarte-routing.workers.dev`, а не у `content-a.strava.com` напрямую

#### Scenario: Слой Tracestrack

- **WHEN** включена подложка «Tracestrack Topo»
- **THEN** тайлы запрашиваются у `nakarte-cors-proxy.nakarte-routing.workers.dev` по адресу `…/https/tile.tracestrack.com/topo_<язык>/…` без параметра `key`, а не у `tile.tracestrack.com` напрямую

## ADDED Requirements

### Requirement: Язык подписей Tracestrack

Подложка «Tracestrack Topo» SHALL показывать подписи на языке браузера, если Tracestrack его поддерживает, а иначе — на английском. Язык SHALL быть частью адреса тайла.

#### Scenario: Браузер на русском

- **WHEN** язык браузера — `ru-RU`
- **THEN** тайлы Tracestrack запрашиваются по адресу `…/tile.tracestrack.com/topo_ru/…`

#### Scenario: Язык, которого нет у Tracestrack

- **WHEN** язык браузера — `ka-GE`
- **THEN** тайлы Tracestrack запрашиваются по адресу `…/tile.tracestrack.com/topo_en/…`
