import { describe, expect, test } from 'vitest';
import type { LatLng } from '@/tracks/model';
import { createRouteEditor, HISTORY_LIMIT, type RouteFn } from './editor';
import { fromSegment, type Leg, type RouteLine, toSegment } from './line';

// Сценарии спек route-editing и routing на модели без карты: роутер поддельный, каждый запрос ждёт, пока тест сам
// ответит (resolve) или откажет (reject).

interface Call {
    from: LatLng;
    to: LatLng;
    activity: string;
    signal: AbortSignal;
    resolve(points: LatLng[]): void;
    reject(error: Error): void;
}

function fakeRouter() {
    const calls: Call[] = [];
    const settled = new Set<Call>();
    const route: RouteFn = (from, to, activity, signal) =>
        new Promise((resolve, reject) => {
            const call: Call = {
                from,
                to,
                activity,
                signal,
                resolve: (points) => {
                    settled.add(call);
                    resolve(points);
                },
                reject: (error) => {
                    settled.add(call);
                    reject(error);
                },
            };
            calls.push(call);
            signal.addEventListener('abort', () => reject(signal.reason));
        });
    // запросы, которые ещё ждут ответа и не отменены
    return { route, calls, live: () => calls.filter((call) => !call.signal.aborted && !settled.has(call)) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const P = (lat: number, lng: number) => ({ lat, lng });
const A = P(41.69, 44.78);
const B = P(41.7, 44.79);
const C = P(41.71, 44.8);
const D = P(41.72, 44.81);
// «маршрут» между двумя точками: две точки посередине
const road = (from: LatLng, to: LatLng) => [
    P(from.lat + (to.lat - from.lat) / 3, from.lng),
    P(from.lat + ((to.lat - from.lat) * 2) / 3, to.lng),
];

function setup(initial: RouteLine = { waypoints: [], legs: [] }) {
    const router = fakeRouter();
    const errors: unknown[] = [];
    let routed = 0;
    const editor = createRouteEditor(initial, {
        route: router.route,
        onRouteError: (error) => errors.push(error),
        onRouted: () => {
            routed += 1;
        },
    });
    return { editor, router, errors, routed: () => routed };
}

const states = (line: RouteLine) =>
    line.legs.map((leg) => (leg.state === 'straight' ? 'straight' : `${leg.state}:${leg.activity}`));

// линия A–B–C с проложенными отрезками
async function routedLine(activity = 'hiking') {
    const ctx = setup();
    ctx.editor.addWaypoint('end', A, activity);
    ctx.editor.addWaypoint('end', B, activity);
    ctx.editor.addWaypoint('end', C, activity);
    for (const call of ctx.router.live()) {
        call.resolve(road(call.from, call.to));
    }
    await flush();
    return ctx;
}

describe('Опорные точки и точки маршрута', () => {
    test('Построенный отрезок', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        const points = Array.from({ length: 40 }, (_, i) => P(41.69 + i * 0.0002, 44.78 + (i % 2) * 0.0001));
        router.calls[0].resolve(points);
        await flush();
        const line = editor.line();
        expect(line.waypoints).toEqual([A, B]);
        expect(toSegment(line).points).toHaveLength(42);
    });
});

describe('Клик при рисовании', () => {
    test('Несколько кликов подряд', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        editor.addWaypoint('end', C, 'hiking');
        // все три точки сразу, оба отрезка ждут
        expect(editor.line().waypoints).toEqual([A, B, C]);
        expect(states(editor.line())).toEqual(['pending:hiking', 'pending:hiking']);
        expect(editor.pending()).toBe(2);
        // отрезки достраиваются по мере ответов, в любом порядке
        router.calls[1].resolve(road(B, C));
        await flush();
        expect(states(editor.line())).toEqual(['pending:hiking', 'routed:hiking']);
        router.calls[0].resolve(road(A, B));
        await flush();
        expect(states(editor.line())).toEqual(['routed:hiking', 'routed:hiking']);
        expect(editor.pending()).toBe(0);
    });

    test('Alt-клик', () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, null);
        expect(states(editor.line())).toEqual(['straight']);
        expect(router.calls).toHaveLength(0);
    });

    test('Дорисовать с начала', () => {
        const { editor, router } = setup(fromSegment([A, B, C]));
        editor.addWaypoint('start', D, 'gravel');
        expect(editor.line().waypoints).toEqual([D, A, B, C]);
        expect(states(editor.line())).toEqual(['pending:gravel', 'straight', 'straight']);
        expect(router.calls[0].from).toEqual(D);
        expect(router.calls[0].to).toEqual(A);
    });
});

describe('Устаревшие ответы отбрасываются', () => {
    test('Точку перетащили во время запроса', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        const moved = P(41.705, 44.795);
        editor.moveWaypoint(1, moved);
        const [stale, fresh] = router.calls;
        expect(stale.signal.aborted).toBe(true);
        expect(fresh.to).toEqual(moved);
        // ответ для старого положения не применяется
        stale.resolve(road(A, B));
        await flush();
        expect(states(editor.line())).toEqual(['pending:hiking']);
        fresh.resolve(road(A, moved));
        await flush();
        expect(editor.line().legs[0]).toEqual({ state: 'routed', activity: 'hiking', points: road(A, moved) });
    });
});

describe('Активность хранится в отрезке', () => {
    test('Смешанный трек', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'road-bike');
        editor.addWaypoint('end', B, 'road-bike');
        editor.addWaypoint('end', C, 'hiking');
        for (const call of router.live()) {
            call.resolve(road(call.from, call.to));
        }
        await flush();
        editor.moveWaypoint(1, P(41.701, 44.791));
        expect(router.live().map((call) => call.activity)).toEqual(['road-bike', 'hiking']);
    });
});

describe('Удаление последней точки', () => {
    test('Backspace', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        router.calls[0].resolve(road(A, B));
        await flush();
        editor.addWaypoint('end', C, 'hiking');
        editor.removeEndWaypoint('end');
        // последняя точка и её отрезок удалены, ожидающий запрос отменён
        expect(editor.line().waypoints).toEqual([A, B]);
        expect(states(editor.line())).toEqual(['routed:hiking']);
        expect(router.calls[1].signal.aborted).toBe(true);
    });

    test('последняя точка не удаляется', () => {
        const { editor } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.removeEndWaypoint('end');
        expect(editor.line().waypoints).toEqual([A]);
    });
});

describe('Перетаскивание опорной точки', () => {
    test('Точка между двумя отрезками', async () => {
        const { editor, router } = await routedLine();
        const moved = P(41.702, 44.792);
        editor.moveWaypoint(1, moved);
        const live = router.live();
        expect(live.map((call) => [call.from, call.to])).toEqual([
            [A, moved],
            [moved, C],
        ]);
    });

    test('прямые соседние отрезки остаются прямыми', () => {
        const { editor, router } = setup(fromSegment([A, B, C]));
        editor.moveWaypoint(1, P(41.702, 44.792));
        expect(states(editor.line())).toEqual(['straight', 'straight']);
        expect(router.calls).toHaveLength(0);
    });

    test('Повтор после ошибки', async () => {
        const { editor, router, errors } = setup();
        editor.addWaypoint('end', A, 'mtb');
        editor.addWaypoint('end', B, 'mtb');
        router.calls[0].reject(new Error('no route found'));
        await flush();
        expect(states(editor.line())).toEqual(['failed:mtb']);
        expect(errors).toHaveLength(1);
        editor.moveWaypoint(1, P(41.701, 44.791));
        expect(router.calls[1].activity).toBe('mtb');
        router.calls[1].resolve(road(A, B));
        await flush();
        expect(states(editor.line())).toEqual(['routed:mtb']);
    });
});

describe('Удаление опорной точки двойным кликом', () => {
    test('Удаление средней точки', async () => {
        const { editor, router } = await routedLine('gravel');
        editor.removeWaypoint(1);
        expect(editor.line().waypoints).toEqual([A, C]);
        expect(states(editor.line())).toEqual(['pending:gravel']);
        expect(router.live().map((call) => [call.from, call.to])).toEqual([[A, C]]);
    });

    test('оба соседа прямые — соседи соединяются прямой', () => {
        const { editor, router } = setup(fromSegment([A, B, C]));
        editor.removeWaypoint(1);
        expect(states(editor.line())).toEqual(['straight']);
        expect(router.calls).toHaveLength(0);
    });

    test('активность берётся у соседнего отрезка с активностью', () => {
        const line: RouteLine = {
            waypoints: [A, B, C],
            legs: [{ state: 'straight' }, { state: 'failed', activity: 'mtb' }],
        };
        const { editor } = setup(line);
        editor.removeWaypoint(1);
        expect(states(editor.line())).toEqual(['pending:mtb']);
    });

    test('крайняя точка уходит со своим отрезком', async () => {
        const { editor } = await routedLine();
        editor.removeWaypoint(0);
        expect(editor.line().waypoints).toEqual([B, C]);
        expect(states(editor.line())).toEqual(['routed:hiking']);
    });
});

describe('Вставка опорной точки на линию', () => {
    test('геометрия сохраняется, пока точку не сдвинули', async () => {
        const { editor, router } = await routedLine();
        const before = toSegment(editor.line()).points;
        const [r1, r2] = road(A, B);
        const index = editor.insertWaypoint(0, P((r1.lat + r2.lat) / 2, (r1.lng + r2.lng) / 2));
        expect(index).toBe(1);
        const legs = editor.line().legs as Extract<Leg, { state: 'routed' }>[];
        expect(legs[0].points).toEqual([r1]);
        expect(legs[1].points).toEqual([r2]);
        expect(router.live()).toHaveLength(0);
        // точки трека — те же плюс новая опорная
        expect(toSegment(editor.line()).points).toHaveLength(before.length + 1);
    });

    test('Вставка с перетаскиванием', async () => {
        const { editor, router } = await routedLine();
        const index = editor.insertWaypoint(0, road(A, B)[0]);
        const moved = P(41.695, 44.77);
        editor.moveWaypoint(index, moved);
        expect(router.live().map((call) => [call.from, call.to])).toEqual([
            [A, moved],
            [moved, B],
        ]);
        // вставка и перетаскивание — один шаг истории
        editor.undo();
        expect(editor.line().waypoints).toEqual([A, B, C]);
    });

    test('точка вставки встаёт на линию, а не туда, где нажали рядом с ней', () => {
        const { editor } = setup(fromSegment([P(41.69, 44.78), P(41.69, 44.8)]));
        editor.insertWaypoint(0, P(41.6901, 44.79));
        expect(editor.line().waypoints[1].lat).toBeCloseTo(41.69, 10);
        expect(editor.line().waypoints[1].lng).toBeCloseTo(44.79, 10);
    });

    test('вставка на прямой отрезок даёт два прямых', () => {
        const { editor } = setup(fromSegment([A, B]));
        editor.insertWaypoint(0, P(41.695, 44.785));
        expect(states(editor.line())).toEqual(['straight', 'straight']);
    });
});

describe('Undo и redo', () => {
    test('Отмена клика', async () => {
        const { editor, router } = await routedLine();
        editor.addWaypoint('end', D, 'hiking');
        editor.undo();
        // точка и её отрезок исчезли, запрос отменён
        expect(editor.line().waypoints).toEqual([A, B, C]);
        expect(router.calls.at(-1)?.signal.aborted).toBe(true);
        expect(editor.canRedo()).toBe(true);
        editor.redo();
        expect(editor.line().waypoints).toEqual([A, B, C, D]);
        expect(states(editor.line()).at(-1)).toBe('pending:hiking');
    });

    test('Отмена при ожидающем запросе', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        editor.addWaypoint('end', C, 'hiking');
        const before = router.live();
        editor.undo();
        // все текущие запросы отменены, а A–B, который ждал маршрута в восстановленном состоянии, запрошен заново
        expect(before.every((call) => call.signal.aborted)).toBe(true);
        const again = router.live();
        expect(again.map((call) => [call.from, call.to])).toEqual([[A, B]]);
        again[0].resolve(road(A, B));
        await flush();
        expect(states(editor.line())).toEqual(['routed:hiking']);
    });

    test('ответ роутера в историю не пишется', async () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        router.calls[0].resolve(road(A, B));
        await flush();
        editor.undo();
        expect(editor.line().waypoints).toEqual([A]);
    });

    test(`история — до ${HISTORY_LIMIT} шагов`, () => {
        const { editor } = setup();
        for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
            editor.addWaypoint('end', P(41 + i * 0.001, 44), null);
        }
        let undone = 0;
        while (editor.canUndo()) {
            editor.undo();
            undone += 1;
        }
        expect(undone).toBe(HISTORY_LIMIT);
        expect(editor.line().waypoints).toHaveLength(20);
    });

    test('правка без изменений историю не трогает', () => {
        const { editor } = setup(fromSegment([A, B]));
        editor.moveWaypoint(1, { ...B });
        editor.removeEndWaypoint('end');
        editor.removeEndWaypoint('end');
        expect(editor.line().waypoints).toEqual([A]);
        editor.undo();
        expect(editor.line().waypoints).toEqual([A, B]);
        expect(editor.canUndo()).toBe(false);
    });
});

describe('Ошибка прокладки', () => {
    test('Нет маршрута', async () => {
        const { editor, router, errors } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        router.calls[0].reject(new Error('no route found'));
        await flush();
        // прямая между опорными точками с пометкой и ошибка наружу
        expect(toSegment(editor.line()).points).toEqual([A, B]);
        expect(states(editor.line())).toEqual(['failed:hiking']);
        expect((errors[0] as Error).message).toBe('no route found');
    });

    test('отменённый запрос ошибкой не считается', async () => {
        const { editor, errors } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        editor.dispose();
        await flush();
        expect(errors).toEqual([]);
    });

    test('успешный маршрут сообщается наружу', async () => {
        const { routed } = await routedLine();
        expect(routed()).toBe(2);
    });
});

describe('Срез участка', () => {
    test('срез — один шаг undo, redo возвращает его', async () => {
        const { editor, router } = await routedLine();
        expect(editor.shortcut({ waypoint: 0 }, { waypoint: 2 })).toBe(true);
        expect(editor.line().waypoints).toEqual([A, C]);
        expect(states(editor.line())).toEqual(['straight']);
        // прямой стык прокладку не запускает
        expect(router.live()).toHaveLength(0);
        editor.undo();
        expect(editor.line().waypoints).toEqual([A, B, C]);
        expect(states(editor.line())).toEqual(['routed:hiking', 'routed:hiking']);
        editor.redo();
        expect(editor.line().waypoints).toEqual([A, C]);
    });

    test('удалять нечего — линия и история без изменений', () => {
        const { editor } = setup(fromSegment([A, B, C]));
        expect(editor.shortcut({ waypoint: 0 }, { waypoint: 1 })).toBe(false);
        expect(editor.canUndo()).toBe(false);
    });

    test('ожидающий отрезок с новым концом запрашивается заново, со старыми концами — ждёт свой ответ', () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        editor.addWaypoint('end', C, 'hiking');
        editor.addWaypoint('end', D, 'hiking');
        const [ab, bc, cd] = router.calls;
        // срез от середины A–B до C: A–X — новый запрос, C–D ждёт свой
        editor.shortcut({ leg: 0, latlng: P(41.695, 44.785) }, { waypoint: 2 });
        expect(states(editor.line())).toEqual(['pending:hiking', 'straight', 'pending:hiking']);
        expect(ab.signal.aborted).toBe(true);
        expect(bc.signal.aborted).toBe(true);
        expect(cd.signal.aborted).toBe(false);
        expect(router.live()).toHaveLength(2);
        expect(router.live()[1].to).toEqual(editor.line().waypoints[1]);
    });
});

describe('Разворот отрезка', () => {
    test('разворот — шаг undo, проложенные отрезки остаются проложенными', async () => {
        const { editor } = await routedLine('road-bike');
        const before = toSegment(editor.line()).points;
        editor.reverse();
        expect(editor.line().waypoints).toEqual([C, B, A]);
        expect(states(editor.line())).toEqual(['routed:road-bike', 'routed:road-bike']);
        expect(toSegment(editor.line()).points).toEqual([...before].reverse());
        editor.undo();
        expect(editor.line().waypoints).toEqual([A, B, C]);
    });

    test('ожидающий отрезок после разворота запрашивается заново в новом направлении', () => {
        const { editor, router } = setup();
        editor.addWaypoint('end', A, 'hiking');
        editor.addWaypoint('end', B, 'hiking');
        editor.reverse();
        expect(router.calls[0].signal.aborted).toBe(true);
        expect(router.live()).toHaveLength(1);
        expect(router.live()[0].from).toEqual(B);
        expect(router.live()[0].to).toEqual(A);
    });
});
