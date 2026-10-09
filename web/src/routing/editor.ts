import type { LatLng } from '@/tracks/model';
import { hasActivity, type Leg, type RouteLine, STRAIGHT } from './line';
import { type LinePlace, reverseLine, shortcutLine, splitLeg } from './line-tools';

// Редактор одной линии без карты (design add-web-route-editor, «Редактор — модель с очередью и историей»; спека
// route-editing). Правки ставят опорные точки сразу, а отрезки с активностью уходят в роутер асинхронно: отрезок ждёт
// со своим номером запроса, ответ применяется, только если этот номер ещё лежит в линии, — иначе отрезок перетащили,
// удалили или отменили, и ответ молча отбрасывается («Устаревшие ответы отбрасываются»). Очередь самих расчётов — в
// движке (engine.ts), здесь только отмена: запрос, чей отрезок ушёл из линии, отменяется AbortController'ом.

export type End = 'start' | 'end';

export type RouteFn = (from: LatLng, to: LatLng, activity: string, signal: AbortSignal) => Promise<LatLng[]>;

export interface RouteEditorOptions {
    route: RouteFn;
    // линия изменилась: правка, ответ роутера, undo/redo
    onChange?: (line: RouteLine) => void;
    // отрезок не проложен: ошибка роутера (отмена сюда не попадает)
    onRouteError?: (error: unknown) => void;
    // отрезок проложен: роутер жив
    onRouted?: () => void;
}

export interface RouteEditor {
    line(): RouteLine;
    // новая опорная точка с конца; activity null — прямой отрезок («Off» или Alt-клик)
    addWaypoint(end: End, latlng: LatLng, activity: string | null): void;
    // Backspace при рисовании: крайняя опорная точка уходит вместе со своим отрезком
    removeEndWaypoint(end: End): void;
    moveWaypoint(index: number, latlng: LatLng): void;
    // двойной клик по опорной точке
    removeWaypoint(index: number): void;
    // нажатие на отрезок legIndex: возвращает номер новой опорной точки; перетаскивание сразу после — тот же шаг истории
    insertWaypoint(legIndex: number, latlng: LatLng): number;
    // Shortcut (design add-web-line-tools): участок между местами — прямой отрезок; false — удалять нечего
    shortcut(from: LinePlace, to: LinePlace): boolean;
    // Reverse отрезка из меню: линия задом наперёд вместе с разметкой
    reverse(): void;
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    // сколько отрезков ждут маршрута (курсор «ожидание»)
    pending(): number;
    // отменить все запросы: редактор больше не нужен
    dispose(): void;
}

// История — до 100 шагов, как у старого редактора (_historyLimit)
export const HISTORY_LIMIT = 100;

let lastRequest = 0;

function pendingLeg(activity: string): Leg {
    lastRequest += 1;
    return { state: 'pending', activity, request: lastRequest };
}

// Отрезок после того, как сдвинулся его конец: с активностью — заново со своей активностью, прямой — прямой
function rerouted(leg: Leg | undefined): Leg {
    return leg && hasActivity(leg) ? pendingLeg(leg.activity) : STRAIGHT;
}

// Ожидающие отрезки, у которых после правки другие концы (вставка точки, срез, разворот), — новые запросы: ответ на
// прежний запрос считался между другими точками. Отрезок, чей запрос и концы те же, ждёт свой ответ дальше.
function renewPending(prev: RouteLine, next: RouteLine): RouteLine {
    const ends = new Map<number, [LatLng, LatLng]>();
    prev.legs.forEach((leg, i) => {
        if (leg.state === 'pending') {
            ends.set(leg.request, [prev.waypoints[i], prev.waypoints[i + 1]]);
        }
    });
    const kept = new Set<number>();
    let changed = false;
    const legs = next.legs.map((leg, i) => {
        if (leg.state !== 'pending') {
            return leg;
        }
        const old = ends.get(leg.request);
        if (old && !kept.has(leg.request) && old[0] === next.waypoints[i] && old[1] === next.waypoints[i + 1]) {
            kept.add(leg.request);
            return leg;
        }
        changed = true;
        return pendingLeg(leg.activity);
    });
    return changed ? { waypoints: next.waypoints, legs } : next;
}

export function createRouteEditor(initial: RouteLine, options: RouteEditorOptions): RouteEditor {
    let line: RouteLine = initial;
    let undoStack: RouteLine[] = [];
    let redoStack: RouteLine[] = [];
    // номер точки, только что вставленной на отрезок: её перетаскивание — тот же шаг истории (_justInsertedNode)
    let justInserted: number | null = null;
    const requests = new Map<number, AbortController>();

    function pendingRequests(target: RouteLine): Set<number> {
        const ids = new Set<number>();
        for (const leg of target.legs) {
            if (leg.state === 'pending') {
                ids.add(leg.request);
            }
        }
        return ids;
    }

    // Новая линия: запросы, чьих отрезков в ней больше нет, отменяются; новые ожидающие отрезки уходят в роутер
    function setLine(next: RouteLine) {
        line = next;
        const live = pendingRequests(next);
        for (const [id, controller] of requests) {
            if (!live.has(id)) {
                controller.abort();
                requests.delete(id);
            }
        }
        next.legs.forEach((leg, i) => {
            if (leg.state === 'pending' && !requests.has(leg.request)) {
                request(leg.request, leg.activity, next.waypoints[i], next.waypoints[i + 1]);
            }
        });
        options.onChange?.(line);
    }

    function request(id: number, activity: string, from: LatLng, to: LatLng) {
        const controller = new AbortController();
        requests.set(id, controller);
        options.route(from, to, activity, controller.signal).then(
            (points) => {
                if (controller.signal.aborted) {
                    return;
                }
                requests.delete(id);
                options.onRouted?.();
                applyResponse(id, { state: 'routed', activity, points });
            },
            (error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }
                requests.delete(id);
                applyResponse(id, { state: 'failed', activity });
                options.onRouteError?.(error);
            },
        );
    }

    // Ответ меняет только свой отрезок и в историю не пишется: undo отменяет правку, а не приход маршрута
    function applyResponse(id: number, leg: Leg) {
        const index = line.legs.findIndex((item) => item.state === 'pending' && item.request === id);
        if (index < 0) {
            return;
        }
        const legs = line.legs.slice();
        legs[index] = leg;
        line = { waypoints: line.waypoints, legs };
        options.onChange?.(line);
    }

    // Правка: прежняя линия — в историю, redo очищается
    function edit(next: RouteLine) {
        justInserted = null;
        undoStack.push(line);
        if (undoStack.length > HISTORY_LIMIT) {
            undoStack.shift();
        }
        redoStack = [];
        setLine(next);
    }

    // Снимок из истории: ожидающие в нём отрезки запрашиваются заново («Отмена при ожидающем запросе»)
    function restore(snapshot: RouteLine) {
        justInserted = null;
        setLine({
            waypoints: snapshot.waypoints,
            legs: snapshot.legs.map((leg) => (leg.state === 'pending' ? pendingLeg(leg.activity) : leg)),
        });
    }

    return {
        line: () => line,

        addWaypoint(end, latlng, activity) {
            const { waypoints, legs } = line;
            if (waypoints.length === 0) {
                edit({ waypoints: [latlng], legs: [] });
                return;
            }
            const leg = activity ? pendingLeg(activity) : STRAIGHT;
            edit(
                end === 'end'
                    ? { waypoints: [...waypoints, latlng], legs: [...legs, leg] }
                    : { waypoints: [latlng, ...waypoints], legs: [leg, ...legs] },
            );
        },

        removeEndWaypoint(end) {
            const { waypoints, legs } = line;
            if (waypoints.length < 2) {
                return;
            }
            edit(
                end === 'end'
                    ? { waypoints: waypoints.slice(0, -1), legs: legs.slice(0, -1) }
                    : { waypoints: waypoints.slice(1), legs: legs.slice(1) },
            );
        },

        moveWaypoint(index, latlng) {
            const { waypoints, legs } = line;
            const old = waypoints[index];
            if (!old || (old.lat === latlng.lat && old.lng === latlng.lng)) {
                return;
            }
            const next = {
                waypoints: waypoints.map((point, i) => (i === index ? latlng : point)),
                legs: legs.map((leg, i) => (i === index - 1 || i === index ? rerouted(leg) : leg)),
            };
            if (justInserted === index) {
                // вставка и перетаскивание — один шаг: снимок до вставки уже в истории
                justInserted = null;
                setLine(next);
                return;
            }
            edit(next);
        },

        removeWaypoint(index) {
            const { waypoints, legs } = line;
            if (!waypoints[index] || waypoints.length < 2) {
                return;
            }
            const before = legs[index - 1];
            const after = legs[index];
            if (!before || !after) {
                // крайняя точка уходит вместе со своим отрезком
                edit({
                    waypoints: waypoints.filter((_, i) => i !== index),
                    legs: index === 0 ? legs.slice(1) : legs.slice(0, -1),
                });
                return;
            }
            // один отрезок между соседями с активностью соседнего отрезка, без неё — прямая
            const source = hasActivity(before) ? before : after;
            const merged = hasActivity(source) ? pendingLeg(source.activity) : STRAIGHT;
            edit({
                waypoints: waypoints.filter((_, i) => i !== index),
                legs: [...legs.slice(0, index - 1), merged, ...legs.slice(index + 1)],
            });
        },

        insertWaypoint(legIndex, latlng) {
            // Новая точка встаёт на ближайшее к нажатию звено, а не туда, где нажали: попадание по линии засчитывается в
            // нескольких пикселях от неё, и без проекции на линии появился бы излом. Геометрия не меняется, пока точку
            // не сдвинули.
            const split = splitLeg(line, legIndex, latlng);
            if (!split) {
                return -1;
            }
            edit(renewPending(line, split.line));
            justInserted = split.index;
            return split.index;
        },

        shortcut(from, to) {
            const next = shortcutLine(line, from, to);
            if (!next) {
                return false;
            }
            edit(renewPending(line, next));
            return true;
        },

        reverse() {
            if (line.waypoints.length < 2) {
                return;
            }
            edit(renewPending(line, reverseLine(line)));
        },

        undo() {
            const snapshot = undoStack.pop();
            if (!snapshot) {
                return;
            }
            redoStack.push(line);
            restore(snapshot);
        },

        redo() {
            const snapshot = redoStack.pop();
            if (!snapshot) {
                return;
            }
            undoStack.push(line);
            restore(snapshot);
        },

        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        pending: () => line.legs.filter((leg) => leg.state === 'pending').length,

        dispose() {
            for (const controller of requests.values()) {
                controller.abort();
            }
            requests.clear();
            undoStack = [];
            redoStack = [];
        },
    };
}
