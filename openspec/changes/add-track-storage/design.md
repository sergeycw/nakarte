# Design

## Context

Мотивация — в `proposal.md`, общий план — в `openspec/research/own-backends.md`. Контракт клиента: `track-list.js` (`copyTracksLinkToClipboard`) и `lib/services/nakarte/index.js` (`loadFromTextEncodedTrackId`); оба с `withCredentials: true`. Существующие воркеры (`workers/cors-proxy`, `workers/tiles`) без тестов и без `package.json`; прокси деплоится шагом в `.github/workflows/deploy-pages.yml`.

## Goals / Non-Goals

**Goals:**
- Worker, совместимый с клиентом без правок клиента.
- Шаблон сервиса для следующих changes: каталог, `package.json` с тестами, workflow CI, деплой, переключение в `config-target`.

**Non-Goals:**
- Чтение треков из хранилища автора.
- Удаление треков, срок хранения, авторизация.

## Decisions

### Хранение в R2, ключ объекта — ключ ссылки

Объект `tracks/{key}` в отдельном бакете `nakarte-tracks` (EEUR, как `nakarte-tiles`). Записи неизменяемые: ключ — хеш содержимого, перезапись того же ключа бессмысленна. Альтернатива KV отклонена: лимит значения 25 МиБ и платная запись без выигрыша; R2 уже используется клоном.

### md5 той же библиотекой, что клиент

Ключ на клиенте: `btoa(md5(serialized, null, true))` из `blueimp-md5` с заменой символов. Worker считает его тем же `blueimp-md5` над той же строкой, чтобы совпадение было побайтным, без расхождений в кодировке строки. Альтернатива `crypto.subtle.digest('MD5')` отклонена: тело приходит строкой, и её преобразование в байты должно совпасть с тем, что делает `blueimp-md5`; общая библиотека убирает этот риск.

### Лимит 10 МиБ

У автора есть `413`, но порог неизвестен. 10 МиБ с запасом покрывает реальные треки (nktk компактен) и ограничивает злоупотребление хранилищем. Проверка по `Content-Length` и по фактической длине тела.

### CORS по списку origin

Как в `workers/cors-proxy`: `ALLOWED_ORIGINS` в `[vars]`, отражение `Origin`, `Access-Control-Allow-Credentials: true`. Без `Origin` запрос получает `403`: клиент всегда шлёт его при кросс-доменном `fetch`. В отличие от прокси, `Referer` вместо `Origin` не принимается. Список origin — тот же, что у прокси.

### Тесты в рантайме Workers

`workers/tracks/package.json` с `vitest` и `@cloudflare/vitest-pool-workers`: тесты идут в `workerd` с локальным R2, без сети. Workflow `.github/workflows/check-tracks.yml` запускается на изменения `workers/tracks/**` и ставит зависимости только этого каталога. Если пул окажется несовместим с текущими версиями, допустим `wrangler dev` + запросы из теста; выбор фиксируется в этом файле.

Выбран пул: `@cloudflare/vitest-pool-workers` 0.22.0 (точная версия, пакет 0.x меняет API) и `vitest` `^4.1.0` — пул пока не поддерживает `vitest` 5. Конфиг — плагин `cloudflareTest()` с `wrangler.configPath`, привязка `TRACKS` поднимается локальным R2 из `wrangler.toml`. Совместимость с клиентом проверяется фикстурой `test/fixtures/client-track.json`: тело `POST` и ключ `nktl=`, снятые с настоящего `copyTracksLinkToClipboard` на локальном клоне. В каталоге сервиса свой `.npmrc` с `install-strategy=hoisted`, чтобы локальная раскладка `node_modules` совпадала с CI. Подвохи стенда — в `AGENTS.md`.

### Деплой

Шаг `npm ci --omit=dev` и `npx --yes wrangler@4 deploy` с `working-directory: workers/tracks` в `.github/workflows/deploy-pages.yml`, как у прокси. `npm ci` ставит `blueimp-md5` из lock-файла сервиса: без него esbuild нашёл бы пакет в корневом `node_modules` клиента и собрал бы Worker с чужой версией. Бакет R2 создаётся один раз командой `wrangler r2 bucket create`; привязка `TRACKS` в `wrangler.toml`.

## Risks / Trade-offs

- [Хранилище как бесплатный файлообменник] → только origin клона, лимит 10 МиБ; при злоупотреблении — правило rate limiting в Cloudflare.
- [Пользователи клона со старыми ссылками] → клона нет в продакшене, решение владельца — совместимость не нужна.
- [Права токена `CLOUDFLARE_API_TOKEN`] → для R2 нужен Workers R2 Storage Edit; он уже есть у токена (см. AGENTS.md), иначе владелец расширяет права.

## Migration Plan

Деплой Worker, затем переключение `tracksStorageServer` в `config-target/clone.js` тем же PR. Откат — вернуть URL автора в `clone.js`.
