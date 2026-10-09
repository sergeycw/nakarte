import type { LatLng } from '@/tracks/model';
import { hasActivity, type Leg, legPath, type RouteLine, STRAIGHT } from './line';

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

// Ближайшая к p точка звена a–b и квадрат расстояния до неё — в градусах с поправкой долготы на широту: для выбора
// звена и точки вставки этого хватает, точность в метрах не нужна
function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; sqDist: number } {
    const k = Math.cos((p.lat * Math.PI) / 180);
    const dx = (b.lng - a.lng) * k;
    const dy = b.lat - a.lat;
    const dot = dx * dx + dy * dy;
    let t = dot > 0 ? ((p.lng - a.lng) * k * dx + (p.lat - a.lat) * dy) / dot : 0;
    t = Math.max(0, Math.min(1, t));
    const point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    return { point, sqDist: ((p.lng - point.lng) * k) ** 2 + (p.lat - point.lat) ** 2 };
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
            const { waypoints, legs } = line;
            const leg = legs[legIndex];
            if (!leg) {
                return -1;
            }
            // Новая точка встаёт на ближайшее к нажатию звено, а не туда, где нажали: попадание по линии засчитывается в
            // нескольких пикселях от неё, и без проекции на линии появился бы излом. Геометрия не меняется, пока точку
            // не сдвинули.
            const path = legPath(line, legIndex);
            let nearest = 0;
            let best = Number.POSITIVE_INFINITY;
            let at = latlng;
            for (let k = 0; k < path.length - 1; k++) {
                const { point, sqDist } = closestOnSegment(latlng, path[k], path[k + 1]);
                if (sqDist < best) {
                    best = sqDist;
                    nearest = k;
                    at = point;
                }
            }
            let left: Leg;
            let right: Leg;
            if (leg.state === 'routed') {
                // звено path[nearest]–path[nearest + 1]; внутренние точки маршрута — path[1..n−2]
                left = { state: 'routed', activity: leg.activity, points: path.slice(1, nearest + 1) };
                right = { state: 'routed', activity: leg.activity, points: path.slice(nearest + 1, -1) };
            } else if (leg.state === 'pending') {
                left = pendingLeg(leg.activity);
                right = pendingLeg(leg.activity);
            } else {
                left = leg;
                right = leg;
            }
            const index = legIndex + 1;
            edit({
                waypoints: [...waypoints.slice(0, index), at, ...waypoints.slice(index)],
                legs: [...legs.slice(0, legIndex), left, right, ...legs.slice(legIndex + 1)],
            });
            justInserted = index;
            return index;
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
