import { simplify, unwrapLine } from '@/tracks/geometry';
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
// матчил по сетке ~2.4 м): ссылка и автосохранение пишут разметку рядом с геометрией, и упрощение линии опорные точки
// не трогает (simplifyRouted ниже, design add-web-autosave).
export type LegMark = { state: 'straight' } | { state: 'routed' | 'pending' | 'failed'; activity: string };

export interface SegmentRoute {
    waypoints: readonly number[];
    legs: readonly LegMark[];
}

export const STRAIGHT: Leg = { state: 'straight' };

const MARK_STATES = new Set(['straight', 'routed', 'pending', 'failed']);

// Форма разметки из чужих рук (запись IndexedDB): массивы целых номеров и отрезки с известным состоянием и строкой
// активности. Без этой проверки мусор в базе бросал бы исключение посреди восстановления.
export function isRouteShape(value: unknown): value is SegmentRoute {
    const route = value as SegmentRoute | null;
    return (
        typeof route === 'object' &&
        route !== null &&
        Array.isArray(route.waypoints) &&
        route.waypoints.every(Number.isInteger) &&
        Array.isArray(route.legs) &&
        route.legs.every(
            (leg) =>
                typeof leg === 'object' &&
                leg !== null &&
                MARK_STATES.has(leg.state) &&
                (leg.state === 'straight' || typeof leg.activity === 'string'),
        )
    );
}

export function hasActivity(leg: Leg | LegMark): leg is Exclude<Leg, { state: 'straight' }> {
    return leg.state !== 'straight';
}

function plainLine(points: readonly LatLng[]): RouteLine {
    return { waypoints: points.slice(), legs: points.slice(1).map(() => STRAIGHT) };
}

// Разметка годна, если опорные точки — возрастающие номера от первой до последней точки отрезка, а у отрезков без
// точек маршрута (прямой, ожидающий, непроложенный) нет промежуточных узлов. Разметку из ссылки и из автосохранения
// проверяют этой же функцией: негодная отбрасывается, отрезок остаётся ломаной. Чужой ввод (ссылка, запись базы) сначала
// проходит isRouteShape — routeFits полагается на форму.
export function routeFits(points: readonly LatLng[], route: SegmentRoute): boolean {
    const { waypoints, legs } = route;
    if (waypoints.length === 0 || waypoints[0] !== 0 || waypoints.at(-1) !== points.length - 1) {
        return false;
    }
    // разметка без единого отрезка с активностью — та же ломаная: toSegment такую не пишет, чужую не принимаем
    if (legs.length !== waypoints.length - 1 || !legs.some((leg) => leg?.state !== 'straight')) {
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

// Упрощение отрезка с разметкой (simplifyKeepingWaypoints старого клиента): линия разворачивается через 180° целиком,
// каждый проложенный отрезок упрощается отдельно вместе со своими опорными концами, номера опорных пересчитываются.
// Опорные точки не участвуют в отсеве, поэтому разметка остаётся верной (design add-web-autosave, «Упрощение линии не
// трогает опорные точки»). null — разметки нет или она негодна: такой отрезок упрощается как обычная ломаная.
export function simplifyRouted(
    points: readonly LatLng[],
    route: SegmentRoute | null | undefined,
): { points: LatLng[]; route: SegmentRoute } | null {
    const settled = settledRoute(route);
    if (!settled || !routeFits(points, settled)) {
        return null;
    }
    const line = unwrapLine(points);
    const result = [line[0]];
    const waypoints = [0];
    settled.legs.forEach((leg, i) => {
        const from = settled.waypoints[i];
        const to = settled.waypoints[i + 1];
        const path = leg.state === 'routed' ? simplify(line.slice(from, to + 1)) : [line[from], line[to]];
        result.push(...path.slice(1));
        waypoints.push(result.length - 1);
    });
    return { points: result, route: { waypoints, legs: settled.legs } };
}
