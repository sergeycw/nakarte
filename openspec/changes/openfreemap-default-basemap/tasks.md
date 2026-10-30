# Tasks

## 1. Ветка

- [x] 1.1 Перенести в ветку change коммиты ветки `research-load-capacity` (#178: ресёрч нагрузки и строка `AGENTS.md` о правиле Sentry `$user.geo`) cherry-pick'ом, по коммиту на смысл; закрыть #178 после мержа этого PR. Проверка: `git log master..HEAD` показывает оба коммита, ссылки `openspec/research/load-capacity.md` открываются.

## 2. Умолчание и цепочка отката

- [x] 2.1 `selection.ts`: `DEFAULT_SELECTION.base = 'Of'`, таблица `BASEMAP_FALLBACKS = { Of: 'Tt', Tt: 'O' }` вместо `FALLBACK_BASE`; комментарий — почему `Of` и откуда цепочка. Проверка: unit `selection.test.ts` — умолчание `Of`, следующая подложка для `Of`, `Tt`, у `O` и прочих — нет.
- [x] 2.2 `store.ts`: `fallBackBase` по таблице, `basemapFallback` — первая подложка цепочки; `savedSelection` сохраняет её, пока текущая подложка — звено цепочки после неё. Проверка: unit `store.test.ts` — «OpenFreeMap недоступен», «Недоступны обе» (`Of` → `Tt` → `O`, `basemapFallback` = `Of`, сохраняется `Of`), «Нет ключа или квоты» (`Tt` → `O`), «Выбор после отката»; `sync.test.ts` — «Первый заход без настроек» (`l=Of`), «Следующий заход после отката» (пробует `Of`), «Tracestrack до смены умолчания».
- [x] 2.3 `App.tsx` `showTileError`: откат для любого кода из таблицы, тост `<подложка> is unavailable` / `Switched to <следующая>`. Проверить, с каким `sourceId` и статусом MapLibre шлёт отказ TileJSON `Of`, и ловить его (design, «Ошибка векторного источника»). Проверка: browser `App.browser.test.tsx` — «OpenFreeMap недоступен» (TileJSON и тайлы `Of` — `503`), «Недоступны обе», «Нет ключа или квоты» (`l=Tt`), «Тайла нет» (`404` у `Of` и `Tt`).

## 3. Круг топокарты

- [ ] 3.1 `quick-layers.ts`: группа `Topo layers` — `['Of', 'Tt', 'Otm', 'Oso', 'Ocm', 'Co']`. Проверка: unit `quick-layers.test.ts` — круг топокарты `Of`; browser `LayerSwitcher.browser.test.tsx` — «Превью без настроек» (OpenFreeMap Outdoor, Google Map, ESRI Satellite, отмечен OpenFreeMap Outdoor), «Кнопок столбца в настройке нет» (нет OpenFreeMap Outdoor, Tracestrack Topo отмечен); unit `catalog.test.ts` — «Список слоёв» (первые — Tracestrack Topo, OpenStreetMap, Sentinel-2 cloudless).
- [ ] 3.2 `scripts/layer-thumbnails.mjs`: снимать векторную `Of` (отрисовка MapLibre стилем `Of`, способ — история change `add-vector-outdoor-style`) на месте и зуме прежнего `Tt`; `Of.webp` в `web/src/layers/thumbnails/`, `Tt.webp` и место `Tt` удалить; шапку скрипта поправить. Проверка: `node --experimental-strip-types scripts/layer-thumbnails.mjs Of` даёт картинку 72 px; скриншот столбца справа — владельцу до merge; `npm run build` проходит без `Tt.webp`.

## 4. e2e

- [ ] 4.1 `e2e/map-layers.spec.ts` и `e2e/web-client.spec.ts`: «Первый заход без настроек» и «Первый заход» — подложка `Of` (тайлы `Of` есть, `Tt` нет, подпись OpenFreeMap); «Нет ключа или квоты», «Следующий заход после отката», «Ошибка подложки Tracestrack» — с явным `l=Tt`; новые «OpenFreeMap недоступен» и «Ошибка подложки OpenFreeMap»; остальные e2e, которые ждут `Tt` по умолчанию (`browser-routing-engine.spec.ts` и другие по `grep`), — явный `l=` или новые ожидания. Проверка: `npm run build` с поддельным DSN и `npm run e2e` зелёные.

## 5. Документы

- [ ] 5.1 `AGENTS.md`: подложка по умолчанию — `Of`, откат цепочкой (`BASEMAP_FALLBACKS`), круг топокарты — `Of`; подвох «у браузера, открывавшего сайт до смены умолчания, остаётся сохранённая подложка» — переписать про `Tt`. `docs/architecture/decisions.md` — строка решения со ссылкой на design. `openspec/backlog.md` — пункт Tracestrack (теперь не по умолчанию) и новый риск «OpenFreeMap без SLA: ежедневная проверка `Of`». Шапка `openspec/research/load-capacity.md` — первый вариант сделан, ссылка на архив. Проверка: проверка ссылок (`links.py`) — битых нет.

## 6. Проверка

- [ ] 6.1 Полный прогон: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` с поддельным DSN, `npm run e2e` в `web/`, `openspec validate --all --strict`. Проверка: всё зелёное.

## Workflow follow-up

- Архив в том же PR (`/opsx:archive`), PR — auto-merge после зелёной проверки `test`.
- После деплоя: прод в приватном окне открывается на `Of`, тайлов Tracestrack нет; Web Analytics и `tracestrack check` — без новых шагов.
