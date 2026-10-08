# Tasks

## 1. Тесты

- [x] 1.1 Стенд `workers/tiles` по шаблону `workers/tracks` и тесты `functions/tiles`: Range `0-0`, середина, суффикс, без Range, `416` за концом, `404`, `HEAD`, пустой `storageconfig.txt`, `405`, путь вне `/tiles/`; проверка: `PATH=/usr/local/bin:$PATH npm test` в `workers/tiles` зелёный
- [x] 1.2 Тесты `functions/brouter-wasm` с подставным `ASSETS`: Range, открытый и суффиксный диапазон, `416`, без Range, `HEAD`, отсутствующий файл; проверка: тот же `npm test`
- [x] 1.3 Явный `416` в `workers/tiles` на диапазон за концом тайла; проверка: тест 1.1 на `416` зелёный, прод отвечает `416` (`curl -r 40000000-40000010` на `/tiles/E40_N40.rd5`)

## 2. CI и документы

- [x] 2.1 `.github/workflows/check-tiles.yml` с `paths:` на `workers/tiles/**` и `functions/**`; проверка: зелёный прогон на PR
- [x] 2.2 `AGENTS.md`, `docs/architecture/ci-cd.md`, `openspec/backlog.md`; проверка: линт `NODE_ENV=production npx eslint --ext js .` с `node_modules` сервиса и без, `openspec validate --all --strict`
