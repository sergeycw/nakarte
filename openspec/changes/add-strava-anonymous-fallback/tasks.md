# Tasks

## 1. Анонимные тайлы в прокси

- [x] 1.1 `src/strava.js`: адрес анонимного тайла по адресу тайла heatmap (порог z12 для 256 px, z11 для 512 px, поддомен по `(x + y) % 3`), `src/index.js`: запрос без кук при `none` и повтор после `401`/`403`, `X-Strava-Cookies: anonymous`; проверка — тесты 1.2 зелёные
- [x] 1.2 Тесты vitest без сети: заглушка отвечает `403` на тайл `content-*` без кук и с «мёртвыми» куками и отдаёт анонимный тайл; проверить сессии нет / протухшие куки / z13 / 512 px на z12 / что на анонимный адрес не уходят куки; проверка — `PATH=/usr/local/bin:$PATH npm test` в `workers/cors-proxy` зелёный (`check-cors-proxy.yml`), линт чистый

## 2. Документация и выкатка

- [x] 2.1 `AGENTS.md` (Strava heatmap: анонимные тайлы, кука `_strava4_session` в браузере без срока) и `openspec/backlog.md`; проверка — `openspec validate --all --strict`
- [ ] 2.2 PR, зелёный CI, merge, деплой; проверка — на проде тайл z12 с `X-Strava-Cookies: session` (сессия жива), анонимный путь проверен тестами

## Workflow follow-up

- Архивировать change.
