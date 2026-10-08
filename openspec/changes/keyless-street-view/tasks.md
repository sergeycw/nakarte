# Tasks

## 1. Деплой

- [x] 1.1 Шаг `google maps key` пишет секрет или пустую строку в `google`; проверка: `sed` и `grep` шага на копии шаблона с пустым и непустым ключом дают `google: ''` и `google: '<ключ>'`
- [ ] 1.2 Деплой зелёный; проверка: на `https://nakarte-routing.pages.dev` окно Street View открывает панораму (водяной знак Google, без «Oops! Something went wrong»)

## 2. Документы

- [x] 2.1 `AGENTS.md`, пункт про ключ Google в `openspec/backlog.md`; проверка: `openspec validate --all --strict`

## Workflow follow-up

- Архивировать: `openspec archive keyless-street-view --yes`.
