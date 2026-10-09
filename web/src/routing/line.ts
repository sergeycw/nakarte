import type { LatLng } from '@/tracks/model';

// Модель линии редактора (design add-web-route-editor, «Модель линии»): опорные точки и отрезки между ними, а не плоский
// массив узлов с меткой отрезка у каждого, как у старого редактора (leaflet.polyline-edit). Данные неизменяемые: правка
// даёт новый объект, и устаревший ответ роутера отсекается тем, что его request больше не лежит ни в одном отрезке.

export type Leg =
    | { state: 'straight' }
    // points — точки маршрута между опорными, без самих опорных
    | { state: 'routed'; activity: string; points: readonly LatLng[] }
    | { state: 'pending'; activity: string; request: number }
    // непроложенный отрезок: прямая с пометкой, активность остаётся для повтора (решение владельца, спека routing)
    | { state: 'failed'; activity: string };

export interface RouteLine {
    waypoints: readonly LatLng[];
    // legs.length === waypoints.length − 1 (у линии из одной точки отрезков нет)
    legs: readonly Leg[];
}

// Разметка маршрута в треке, по одной на отрезок трека (TrackData.routes): номера опорных точек в отрезке и состояние
// отрезков между ними без точек — сами точки лежат в segments. Номера, а не координаты (applyRouteMarkup старого клиента
// матчил по сетке ~2.4 м): change 6 пишет разметку рядом с геометрией и обязан не упрощать опорные точки.
export type LegMark = { state: 'straight' } | { state: 'routed' | 'pending' | 'failed'; activity: string };

export interface SegmentRoute {
    waypoints: readonly number[];
    legs: readonly LegMark[];
}

export const STRAIGHT: Leg = { state: 'straight' };

export function hasActivity(leg: Leg | LegMark): leg is Exclude<Leg, { state: 'straight' }> {
    return leg.state !== 'straight';
}

function plainLine(points: readonly LatLng[]): RouteLine {
    return { waypoints: points.slice(), legs: points.slice(1).map(() => STRAIGHT) };
}

// Разметка годна, если опорные точки — возрастающие номера от первой до последней точки отрезка, а у отрезков без
// точек маршрута (прямой, ожидающий, непроложенный) нет промежуточных узлов.
function routeFits(points: readonly LatLng[], route: SegmentRoute): boolean {
    const { waypoints, legs } = route;
    if (waypoints.length === 0 || waypoints[0] !== 0 || waypoints.at(-1) !== points.length - 1) {
        return false;
    }
    if (legs.length !== waypoints.length - 1) {
        return false;
    }
    return legs.every((leg, i) => {
        const gap = waypoints[i + 1] - waypoints[i];
        return leg.state === 'routed' ? gap >= 1 : gap === 1;
    });
}

// Отрезок трека + разметка → линия редактора. Без разметки (или с негодной) каждая точка — опорная, все отрезки прямые:
// так старый редактор открывал импортированную линию. Ожидающий отрезок без живого запроса становится непроложенным.
export function fromSegment(points: readonly LatLng[], route?: SegmentRoute | null): RouteLine {
    if (!route || !routeFits(points, route)) {
        return plainLine(points);
    }
    const { waypoints, legs } = route;
    return {
        waypoints: waypoints.map((index) => points[index]),
        legs: legs.map((mark, i): Leg => {
            if (mark.state === 'routed') {
                return {
                    state: 'routed',
                    activity: mark.activity,
                    points: points.slice(waypoints[i] + 1, waypoints[i + 1]),
                };
            }
            if (mark.state === 'straight') {
                return STRAIGHT;
            }
            return { state: 'failed', activity: mark.activity };
        }),
    };
}

// Линия → точки отрезка трека и разметка. Разметка null, если все отрезки прямые: обычная ломаная её не несёт.
export function toSegment(line: RouteLine): { points: LatLng[]; route: SegmentRoute | null } {
    const points: LatLng[] = [];
    const waypoints: number[] = [];
    line.waypoints.forEach((waypoint, i) => {
        waypoints.push(points.length);
        points.push(waypoint);
        const leg = line.legs[i];
        if (leg?.state === 'routed') {
            points.push(...leg.points);
        }
    });
    if (!line.legs.some(hasActivity)) {
        return { points, route: null };
    }
    const legs = line.legs.map(
        (leg): LegMark => (hasActivity(leg) ? { state: leg.state, activity: leg.activity } : leg),
    );
    return { points, route: { waypoints, legs } };
}

// Разметка без живых запросов: ожидающий отрезок становится непроложенным. Копия трека и развёрнутый трек — новые
// массивы отрезков, редактор их не узнаёт, и ответ на прежний запрос в них уже не придёт: без этого у копии навсегда
// остались бы разрыв и спиннер.
export function settledRoute(route: SegmentRoute | null | undefined): SegmentRoute | null {
    if (!route) {
        return null;
    }
    if (!route.legs.some((leg) => leg.state === 'pending')) {
        return route;
    }
    return {
        waypoints: route.waypoints,
        legs: route.legs.map((leg) => (leg.state === 'pending' ? { state: 'failed', activity: leg.activity } : leg)),
    };
}

// Разметка отрезка, развёрнутого задом наперёд (Reverse): номер i → n − 1 − i, отрезки в обратном порядке
export function reverseRoute(route: SegmentRoute | null | undefined, length: number): SegmentRoute | null {
    const settled = settledRoute(route);
    if (!settled) {
        return null;
    }
    return {
        waypoints: settled.waypoints.map((index) => length - 1 - index).reverse(),
        legs: settled.legs.slice().reverse(),
    };
}

// Точки отрезка между опорными i и i + 1 вместе с концами (для отрисовки и поиска звена под курсором)
export function legPath(line: RouteLine, i: number): LatLng[] {
    const leg = line.legs[i];
    const inner = leg.state === 'routed' ? leg.points : [];
    return [line.waypoints[i], ...inner, line.waypoints[i + 1]];
}

// Все точки линии подряд
export function linePoints(line: RouteLine): LatLng[] {
    return toSegment(line).points;
}
