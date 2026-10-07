# Tasks

## 1. Каркас сервиса

- [ ] 1.1 Создать `workers/tracks/` с `wrangler.toml` (имя `nakarte-tracks`, привязка R2 `TRACKS`, `ALLOWED_ORIGINS` как у `workers/cors-proxy`) и `package.json` с `vitest`, `@cloudflare/vitest-pool-workers`, `blueimp-md5`; проверка: `npm ci && npx vitest run` в каталоге проходит на пустом тесте
- [ ] 1.2 Workflow `.github/workflows/check-tracks.yml` с `paths: ['workers/tracks/**', '.github/workflows/check-tracks.yml']`, запускающий тесты каталога; проверка: workflow зелёный на PR

## 2. Контракт хранилища

- [ ] 2.1 `POST /track/{key}`: проверка формата ключа, md5 через `blueimp-md5`, лимит 10 МиБ, запись в R2 без перезаписи; проверка: тесты на новый трек, повторную запись, подмену ключа (`400`), кривой ключ (`400`), `413`
- [ ] 2.2 `GET /track/{key}`: `200` с `text/plain`, `404` на неизвестный ключ; проверка: тесты чтения после записи и неизвестного ключа
- [ ] 2.3 CORS: отражение разрешённого `Origin`, `Access-Control-Allow-Credentials: true`, `OPTIONS` → `204`, чужой `Origin` → `403`; проверка: тесты на все четыре случая
- [ ] 2.4 Совместимость ключа с клиентом: тест вычисляет ключ так же, как `copyTracksLinkToClipboard` (`btoa(md5(s, null, true))` с заменами), на строке nktk из фикстуры; проверка: Worker принимает этот ключ

## 3. Деплой и клон

- [ ] 3.1 Создать бакет R2 под треки и задеплоить Worker; проверка: `curl -X OPTIONS -H 'Origin: https://nakarte-routing.pages.dev'` на адрес Worker даёт `204` с нужными заголовками
- [ ] 3.2 Шаг деплоя Worker в `.github/workflows/deploy-pages.yml`; проверка: workflow `deploy pages` зелёный после merge
- [ ] 3.3 `tracksStorageServer` в `src/config-target/clone.js` на адрес Worker; проверка: в браузере на локальном клоне (`nakarte-wasm`, 8766) «Copy link» → открытие ссылки восстанавливает трек, запросы уходят на Worker
- [ ] 3.4 Обновить `AGENTS.md` (ресурсы Cloudflare, как запускать тесты сервиса) и `openspec/research/own-backends.md` (статус change); проверка: команды из `AGENTS.md` выполняются как написано

## 4. Прод

- [ ] 4.1 После деплоя на `https://nakarte-routing.pages.dev`: нарисовать трек, «Copy link», открыть ссылку в новой вкладке; проверка: трек тот же, в сети нет запросов к `tracks.nakarte.me`

## Workflow follow-up

- Архивировать change: `openspec archive add-track-storage --yes`. Архивировать до `add-elevation-api`: тот change убирает требование «Авторский бэкенд высот», которое появляется здесь.
