## MODIFIED Requirements

### Requirement: Без слоёв на данных автора

Приложение SHALL не содержать слоёв, данные которых лежат только у автора: 17 слоёв сканов карт на тайлах `tiles.nakarte.me` (коды T, D, N, A, J, C, F, B, K, U, R, E25m, NT1, NT5, T25, MN25, Pur), «Mountain passes (Westra)» (`Wp`) и «geocaching.su» (`Gc`). Их нет ни в одной сборке и ни в выборе слоёв.

#### Scenario: Выбор слоёв

- **WHEN** пользователь открывает выбор слоёв
- **THEN** в нём нет «Soviet topo maps (AtloMaps)», «Topo 10km», «GGC 500m», «Mountain passes (Westra)», «geocaching.su» и остальных слоёв из списка, запросов к `tiles.nakarte.me`, `nakarte.me/westraPasses/` и `nakarte.me/geocachingSu/` нет

### Requirement: Без запросов к инфраструктуре автора

Приложение SHALL не делать сетевых запросов к `nakarte.me` и его поддоменам при работе всех функций: слои, панорамы, поиск, треки, ссылки, высоты. Адреса `nakarte.me` в разборе ссылок (импорт и поиск по ссылкам nakarte.me) запросами не являются и допустимы.

#### Scenario: Сквозная проверка

- **WHEN** по очереди включаются все слои, открывается панорама Street View, строится трек с профилем высот, делается «Copy link» и открывается ссылка nakarte.me
- **THEN** в журнале сетевых запросов нет ни одного адреса `*.nakarte.me`

## REMOVED Requirements

### Requirement: Сборка под клон

**Reason**: Сборки webpack с `NAKARTE_TARGET`, `src/config-target/` и `src/secrets.js` удалены вместе со старым клиентом; журнала событий и Sentry в приложении нет.

**Migration**: Требование «Адреса сервисов клона» спеки `web-client` (режим сборки `clone`), ссылка на репозиторий форка — «Панель с названием и ссылкой на репозиторий» там же, адреса автора в бандле ловит «Бандл без адресов автора» спеки `clone-deploy`.

### Requirement: Только Google Street View в панорамах

**Reason**: Требование описывало список провайдеров панорам старого клиента; в приложении списка нет, панорамы — только Google Street View.

**Migration**: Спека `street-view`: режим Street View и `n2=`, коды удалённых провайдеров в адресе не ломают загрузку и ничего не включают.
