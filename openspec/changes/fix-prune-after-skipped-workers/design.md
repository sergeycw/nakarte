# Design

## Context

Граф job'ов `deploy pages`: `changes` → Worker'ы (`cors-proxy`, `tracks`, `elevation`, `guard`, каждый со своим `if` по выходам `changes`) → `pages` → `prune`; `smoke` ждёт всех. У `pages` и `smoke` в `if` есть `!cancelled() && !failure()`, у `prune` было только `needs.pages.result == 'success'`.

Документация GitHub Actions:
- [expressions, «Status check functions»](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions): если в `if` нет ни одной функции статуса, к нему неявно добавляется `success()`.
- [workflow syntax, `jobs.<job_id>.needs`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds): пропуск или сбой распространяется на всю цепочку зависимых job'ов от точки пропуска дальше, если job не задаёт условие, которое его продолжает.

Значит, пропущенный Worker пропускает `prune` через `pages`, хотя `pages` сам отработал: `pages` продолжает цепочку своим `!cancelled()`, а у `prune` такой функции не было, и неявный `success()` видел пропущенных предков.

## Goals / Non-Goals

**Goals:**
- `prune` идёт после каждой успешной публикации Pages.

**Non-Goals:**
- Логика самой чистки (проверка `canonical_deployment` и коммита) не меняется.
- Остальные job'ы: у Worker'ов единственный предок `changes`, он пропускается только вне `sergeycw/nakarte`, и тогда пропускать всё и нужно; у `pages` и `smoke` функции статуса уже есть.

## Decisions

**`if: ${{ !cancelled() && needs.pages.result == 'success' }}`.** Явная функция статуса снимает неявный `success()`, а `needs.pages.result == 'success'` оставляет чистку только после успешной публикации. Сбой или пропуск `pages` по-прежнему её отменяют.

Альтернативы:
- `always() && …` — документация GitHub советует `!cancelled()` вместо `always()`: с `always()` job идёт и после отмены прогона, а отмена здесь штатная (`cancel-in-progress` на новый push). Удалять деплои в отменённом прогоне нельзя: новый прогон уже публикует свой.
- `!cancelled() && !failure() && …`, как у `pages` — `!failure()` лишнее: `pages` не идёт после упавшего Worker'а, и `needs.pages.result == 'success'` это уже покрывает.
- Перенести чистку шагом в конец `pages` — противоречит требованию «сбой удаления не помечает публикацию упавшей».

**Проверка семантики до merge — пробным workflow в отдельной ветке.** Прогон по merge этого PR не покажет фикс: правка `deploy-pages.yml` выкатывает всё (job `changes`), и `prune` пошёл бы и со старым условием. Поэтому та же форма графа (пропущенный предок → job с `!cancelled()` → зависимый job со старым и новым условием) проверяется на настоящем GitHub Actions пробным workflow на `push` в временную ветку; ветка удаляется после прогона. `act` не годится: это другая реализация, и вопрос как раз в поведении GitHub.

Результат 2026-10-08, прогон `37815542960` на ветке `probe-needs-skip-semantics` (удалена): `skipped=skipped`, `mid=success`, `old=skipped`, `new=success`. Старое условие пропускает job при успешном прямом предке и пропущенном транзитивном, новое — нет.

## Risks / Trade-offs

- [Первый прогон после фикса удалит все накопившиеся деплои разом] → так и задумано требованием; удаление идёт тем же кодом, что уже отработал в прогоне PR #95.
- [Фикс на проде с пропущенными Worker'ами проверится только на следующем push, который меняет Pages] → семантику до merge подтверждает пробный workflow, на проде — `gh run view` первого такого прогона.
