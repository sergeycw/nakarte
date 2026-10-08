## ADDED Requirements

### Requirement: Токен синхронизации

Синхронизация по расписанию и вручную SHALL брать токен Cloudflare из секрета `CLOUDFLARE_TILES_TOKEN`, если он задан, иначе из `CLOUDFLARE_API_TOKEN`, и передавать его только шагу синхронизации.

#### Scenario: Узкий токен заведён

- **WHEN** владелец завёл `CLOUDFLARE_TILES_TOKEN` с записью только в `nakarte-tiles`
- **THEN** синхронизация идёт с ним, `CLOUDFLARE_API_TOKEN` ей не передаётся

#### Scenario: Узкого токена нет

- **WHEN** `CLOUDFLARE_TILES_TOKEN` не задан
- **THEN** синхронизация идёт с `CLOUDFLARE_API_TOKEN`, как раньше
