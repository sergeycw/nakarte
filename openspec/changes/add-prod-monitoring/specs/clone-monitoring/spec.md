## ADDED Requirements

### Requirement: Синтетическая проверка прода

Workflow `prod check` SHALL раз в день, после каждого деплоя хотя бы одного сервиса и вручную проверять каждый свой сервис клона только чтением, без запросов к чужим сайтам. Прогон SHALL падать, если хотя бы одна проверка не прошла, и печатать, какая. В других репозиториях проверка SHALL пропускаться.

#### Scenario: Что проверяется

- **WHEN** запускается `scripts/prod-check.sh`
- **THEN** проверены главная страница, Range у `brouter.jar`, `lookups.dat` и тайла BRouter, высота точки через API высот, тайлы высот z11 (на лету) и z5 (из архива), `404 Track not found` на отсутствующий трек и preflight CORS-прокси

#### Scenario: Сервис сломан

- **WHEN** API высот отвечает `500`
- **THEN** прогон `prod check` красный, в логе строка `FAIL  elevation api: status 500`, GitHub шлёт письмо

#### Scenario: После деплоя

- **WHEN** `deploy pages` выкатил хотя бы один сервис
- **THEN** в том же прогоне job `smoke` запускает ту же проверку

#### Scenario: Чужой форк

- **WHEN** расписание срабатывает не в `sergeycw/nakarte`
- **THEN** проверка пропускается

### Requirement: Журналы Worker'ов

У Worker'ов `nakarte-cors-proxy`, `nakarte-tracks` и `nakarte-elevation` SHALL быть включены Workers Logs, чтобы запросы, ошибки и `console.log` можно было найти после того, как они случились.

#### Scenario: Ошибка вчера

- **WHEN** прокси вчера не обновил куки Strava
- **THEN** строка `strava heatmap cookies not refreshed: <причина>` находится в Workers Logs `nakarte-cors-proxy` в дашборде Cloudflare
