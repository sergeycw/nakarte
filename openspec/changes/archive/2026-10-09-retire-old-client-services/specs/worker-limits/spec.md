## ADDED Requirements

### Requirement: Частота запросов к Worker'ам с одного IP

Каждый Worker клона SHALL ограничивать число запросов с одного IP за окно 60 секунд, отдельным счётчиком на группу: API высот — 60, треки — 60 и из них записи (`POST`) — 10, прокси — 1200 на хосты тайловых слоёв клона и 300 на остальные. Учёт допускает приблизительность платформы (счёт по локациям Cloudflare).

#### Scenario: Превышение лимита API высот

- **WHEN** с одного IP за минуту пришло больше 60 запросов к API высот с разрешённым `Origin`
- **THEN** лишние запросы получают `429`

#### Scenario: Запрос без IP клиента

- **WHEN** у запроса нет IP клиента (локальный `wrangler dev`, тестовый стенд)
- **THEN** частота не ограничивается

#### Scenario: Спам записей треков

- **WHEN** с одного IP за минуту пришло 11 `POST` в хранилище треков
- **THEN** одиннадцатый получает `429`, `GET` с того же IP ещё проходят

#### Scenario: Импорт по ссылке и тайлы слоёв

- **WHEN** с одного IP за минуту пришло 301 запрос через прокси к произвольному хосту
- **THEN** 301-й получает `429`, тайлы слоёв клона с того же IP ещё проходят

## MODIFIED Requirements

### Requirement: Ответ при превышении частоты

Запрос сверх лимита SHALL получать `429` с телом `Too many requests\n`, заголовком `Retry-After: 60` и теми же CORS-заголовками, что ответ сервиса на этот путь: отражённый разрешённый `Origin` с `Access-Control-Allow-Credentials: true` у API высот, треков и прокси. Запрос с неразрешённым `Origin` к сервису со списком origin SHALL получать `403`, как без лимита.

#### Scenario: Клиент видит ошибку, а не сбой CORS

- **WHEN** клон на `https://nakarte-routing.pages.dev` превысил лимит хранилища треков
- **THEN** ответ `429` содержит `Access-Control-Allow-Origin: https://nakarte-routing.pages.dev`, и браузер отдаёт клиенту статус

### Requirement: Потолок ресурсов на вызов

Один вызов Worker'а SHALL прерываться платформой при превышении потолка: `nakarte-elevation` — 10 секунд CPU, `nakarte-tracks` и `nakarte-cors-proxy` — 500 мс CPU; подзапросов — 10 у `nakarte-tracks`, 50 у `nakarte-cors-proxy` и 1 100 у `nakarte-elevation` (запрос API читает не больше 512 раз).

#### Scenario: Зависший запрос

- **WHEN** вызов `nakarte-tracks` расходует больше 500 мс CPU
- **THEN** платформа прерывает его с ошибкой, а не досчитывает до 30 секунд

### Requirement: Только основной адрес Worker'а

Worker'ы клона SHALL отвечать только по основному адресу `<worker>.nakarte-routing.workers.dev`. Version URL (`<версия>-<worker>.nakarte-routing.workers.dev`) и их алиасы SHALL быть выключены для всех версий: иначе старая версия со старыми лимитами обходит лимиты новой.

#### Scenario: Запрос к старой версии

- **WHEN** клиент шлёт `POST https://887323ef-nakarte-elevation.nakarte-routing.workers.dev/` с точкой и разрешённым `Origin`
- **THEN** код старой версии не выполняется, ответ не `200`

#### Scenario: Основной адрес

- **WHEN** клиент шлёт `POST https://nakarte-elevation.nakarte-routing.workers.dev/` с точкой и разрешённым `Origin`
- **THEN** отвечает текущая версия, как раньше

## REMOVED Requirements

### Requirement: Частота запросов с одного IP

**Reason**: Группа тайлов высот (`/tiles/` у `nakarte-elevation`, 600 в минуту) ушла вместе с тайлами высот.

**Migration**: Требование «Частота запросов к Worker'ам с одного IP» — те же группы без тайлов высот.
