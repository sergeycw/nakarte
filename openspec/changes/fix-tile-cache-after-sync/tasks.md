# Tasks

## 1. Тайлы

- [x] 1.1 `Cache-Control: no-store` у ответов тайлов в `workers/tiles/src/index.js`; проверка: тест в `workerd` на заголовок у Range, полного ответа и `HEAD`
- [x] 1.2 Только ключи тайлов и `storageconfig.txt`, остальное `404`; проверка: тест на `/tiles/manifest.json`, регулярка проходит все 1142 имени индекса brouter.de
- [ ] 1.3 После деплоя: `curl -r 0-0` на `/tiles/E40_N40.rd5` — `206` и `no-store`, `/tiles/manifest.json` — `404`

## 2. Документы

- [x] 2.1 `openspec/backlog.md`: остаток риска (страница, открытая во время синхронизации; архив тайлов высот); проверка: `openspec validate --all --strict`
