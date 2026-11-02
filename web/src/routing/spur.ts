import type { LatLng } from '@/tracks/model';
import { legPath, type RouteLine } from './line';

// Ус у поворота (design snap-waypoint-to-turn, спека route-editing, «Опорная точка у поворота»): опорная точка
// поставлена чуть дальше перекрёстка, маршрут доходит до неё и возвращается тем же путём. Каждый отрезок
// прокладывается отдельно, и ус виден только на стыке двух: parseRoute его не замечает. Здесь он ищется по геометрии,
// а опорная точка переезжает в поворот. Общие узлы ответов не годятся: упрощение выкидывает перекрёсток из отрезка,
// который проходит его прямо.

// Ус короче — промах клика (палец ±10–20 px на зуме 15–16 ≈ 10–35 м), длиннее — намеренный заход туда и обратно
export const SPUR_LIMIT = 30;
// Пути считаются одной дорогой ближе этого: упрощение отрезка отходит от дороги не дальше ≈ 2.4 м
const TOLERANCE = 3;
const STEP = 1;
// Сколько пути от опорной точки смотреть: ус до порога и запас, чтобы точки уса сравнивались с целым участком
const REACH = SPUR_LIMIT + 10;
// Маршрут, который возвращается, уходит из опорной точки в ту же сторону, что пришёл: угол между путями меньше 45°.
// Без этого маршрут насквозь (угол ≈ 180°) с изломом в паре метров от точки тоже считался бы усом: в первые метры
// любые два пути из одной точки лежат в TOLERANCE друг от друга.
const SAME_SIDE = Math.cos(Math.PI / 4);

const EARTH_RADIUS = 6371000;
const RAD = Math.PI / 180;

interface XY {
    x: number;
    y: number;
}

// Путь от опорной точки в локальных метрах вокруг неё (ус — десятки метров, плоского приближения хватает)
interface Path {
    points: readonly LatLng[];
    xy: XY[];
    // длина пути от опорной точки до каждой вершины
    arc: number[];
}

function makePath(points: readonly LatLng[], origin: LatLng): Path {
    const k = Math.cos(origin.lat * RAD);
    const xy = points.map((p) => ({
        x: (p.lng - origin.lng) * RAD * EARTH_RADIUS * k,
        y: (p.lat - origin.lat) * RAD * EARTH_RADIUS,
    }));
    const arc = [0];
    for (let i = 1; i < xy.length; i++) {
        arc.push(arc[i - 1] + Math.hypot(xy[i].x - xy[i - 1].x, xy[i].y - xy[i - 1].y));
    }
    return { points, xy, arc };
}

// Ближайшая точка участка пути до REACH: номер звена и расстояние
function nearest(p: XY, path: Path): { link: number; dist: number } {
    let best = { link: 0, dist: Number.POSITIVE_INFINITY };
    for (let i = 0; i < path.xy.length - 1 && path.arc[i] <= REACH; i++) {
        const a = path.xy[i];
        const b = path.xy[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = dx * dx + dy * dy;
        const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
        const dist = Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
        if (dist < best.dist) {
            best = { link: i, dist };
        }
    }
    return best;
}

function pointAt(path: Path, s: number): XY {
    const i = path.arc.findIndex((value) => value >= s);
    if (i <= 0) {
        return i === 0 ? path.xy[0] : path.xy[path.xy.length - 1];
    }
    const t = (s - path.arc[i - 1]) / (path.arc[i] - path.arc[i - 1]);
    const a = path.xy[i - 1];
    const b = path.xy[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Сколько метров path от опорной точки лежит на other. Infinity — пути не расходятся до конца path или до REACH:
// это возврат по всему отрезку или длинный заход, а не ус.
function overlap(path: Path, other: Path): number {
    const length = path.arc[path.arc.length - 1];
    let covered = 0;
    for (let s = STEP; s <= REACH; s += STEP) {
        if (s >= length) {
            return Number.POSITIVE_INFINITY;
        }
        if (nearest(pointAt(path, s), other).dist > TOLERANCE) {
            return covered;
        }
        covered = s;
    }
    return Number.POSITIVE_INFINITY;
}

// Поворот: самая дальняя от опорной точки вершина обоих путей внутри перекрытия, лежащая на другом пути. Обычно это
// узел перекрёстка: в одном из путей он есть всегда, там маршрут меняет направление.
function turnOf(a: Path, b: Path, overlapA: number, overlapB: number): { point: LatLng; arc: number } | null {
    let turn: { point: LatLng; arc: number } | null = null;
    for (const [path, other, covered] of [
        [a, b, overlapA],
        [b, a, overlapB],
    ] as const) {
        // последняя вершина — дальняя опорная точка отрезка, она не поворот
        for (let i = 1; i < path.points.length - 1 && path.arc[i] <= covered; i++) {
            if ((!turn || path.arc[i] > turn.arc) && nearest(path.xy[i], other).dist <= TOLERANCE) {
                turn = { point: path.points[i], arc: path.arc[i] };
            }
        }
    }
    return turn;
}

// Пути уходят из опорной точки в одну сторону: направления на точки в TOLERANCE от неё
function sameSide(a: Path, b: Path): boolean {
    const pa = pointAt(a, TOLERANCE);
    const pb = pointAt(b, TOLERANCE);
    const la = Math.hypot(pa.x, pa.y);
    const lb = Math.hypot(pb.x, pb.y);
    return la > 0 && lb > 0 && (pa.x * pb.x + pa.y * pb.y) / (la * lb) > SAME_SIDE;
}

// Точки пути дальше проекции поворота на него, без дальней опорной точки и без точек ближе TOLERANCE к повороту:
// копия перекрёстка в другом отрезке после упрощения лежит рядом с ним и дала бы зубец
function beyond(path: Path, turn: LatLng, origin: LatLng): LatLng[] {
    const [t] = makePath([turn], origin).xy;
    let first = nearest(t, path).link + 1;
    while (first < path.xy.length - 1 && Math.hypot(path.xy[first].x - t.x, path.xy[first].y - t.y) < TOLERANCE) {
        first += 1;
    }
    return path.points.slice(first, -1);
}

// Линия, где опорная точка index переехала в поворот, а ус убран из обоих соседних отрезков; null — уса нет. Только
// у точки между двумя проложенными отрезками: прямой и ожидающий отрезок геометрии маршрута не несут.
export function trimSpur(line: RouteLine, index: number): RouteLine | null {
    const before = line.legs[index - 1];
    const after = line.legs[index];
    if (before?.state !== 'routed' || after?.state !== 'routed') {
        return null;
    }
    const origin = line.waypoints[index];
    const back = makePath(legPath(line, index - 1).reverse(), origin);
    const ahead = makePath(legPath(line, index), origin);
    if (!sameSide(back, ahead)) {
        return null;
    }
    const overlapBack = overlap(back, ahead);
    const overlapAhead = overlap(ahead, back);
    if (!Number.isFinite(overlapBack) || !Number.isFinite(overlapAhead)) {
        return null;
    }
    const turn = turnOf(back, ahead, overlapBack, overlapAhead);
    if (!turn || turn.arc > SPUR_LIMIT) {
        return null;
    }
    const legs = line.legs.slice();
    legs[index - 1] = { ...before, points: beyond(back, turn.point, origin).reverse() };
    legs[index] = { ...after, points: beyond(ahead, turn.point, origin) };
    return {
        waypoints: line.waypoints.map((point, i) => (i === index ? turn.point : point)),
        legs,
    };
}
