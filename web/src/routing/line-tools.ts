import type { LatLng } from '@/tracks/model';
import type { End } from './editor';
import { type Leg, legPath, type RouteLine, STRAIGHT } from './line';

// Инструменты линии без карты и стора (design add-web-line-tools, «Операции — функции над линией редактора»): Cut,
// Join, Shortcut, разворот отрезка. Работают над неизменяемой RouteLine, поэтому разметка маршрута (какие отрезки
// проложены и с какой активностью) переживает операцию сама: трек хранит её как номера опорных точек, и
// fromSegment/toSegment пересчитывают их. Справочник — splitTrackSegment, joinTrackSegments, getShortCutNodes в
// src/lib/leaflet.control.track-list/track-list.js.

// Место на линии: опорная точка или точка рядом с отрезком leg — она проецируется на ближайшее звено этого отрезка
export type LinePlace = { waypoint: number } | { leg: number; latlng: LatLng };

// Ближайшая к p точка звена a–b и квадрат расстояния до неё — в градусах с поправкой долготы на широту: для выбора
// звена и точки на нём этого хватает, точность в метрах не нужна
export function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; sqDist: number } {
    const k = Math.cos((p.lat * Math.PI) / 180);
    const dx = (b.lng - a.lng) * k;
    const dy = b.lat - a.lat;
    const dot = dx * dx + dy * dy;
    let t = dot > 0 ? ((p.lng - a.lng) * k * dx + (p.lat - a.lat) * dy) / dot : 0;
    t = Math.max(0, Math.min(1, t));
    const point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    return { point, sqDist: ((p.lng - point.lng) * k) ** 2 + (p.lat - point.lat) ** 2 };
}

// Ближайшее к latlng звено отрезка leg: номер звена в legPath и проекция на него
export function nearestLink(line: RouteLine, leg: number, latlng: LatLng): { link: number; point: LatLng } {
    const path = legPath(line, leg);
    let link = 0;
    let best = Number.POSITIVE_INFINITY;
    let point = latlng;
    for (let k = 0; k < path.length - 1; k++) {
        const candidate = closestOnSegment(latlng, path[k], path[k + 1]);
        if (candidate.sqDist < best) {
            best = candidate.sqDist;
            link = k;
            point = candidate.point;
        }
    }
    return { link, point };
}

// Новая опорная точка point на звене link отрезка leg. Проложенный отрезок делится по звену, обе половины проложены той
// же активностью, — геометрия не меняется. Прямой и непроложенный — две копии. Ожидающий — две копии с тем же номером
// запроса: концы у них новые, и редактор заменяет их новыми запросами (renewPending в editor.ts), а операции списка
// делают непроложенными.
function splitAt(line: RouteLine, leg: number, link: number, point: LatLng): { line: RouteLine; index: number } {
    const { waypoints, legs } = line;
    const source = legs[leg];
    let left: Leg = source;
    let right: Leg = source;
    if (source.state === 'routed') {
        // звено path[link]–path[link + 1]; внутренние точки маршрута — path[1..n−2]
        const path = legPath(line, leg);
        left = { ...source, points: path.slice(1, link + 1) };
        right = { ...source, points: path.slice(link + 1, -1) };
    }
    const index = leg + 1;
    return {
        line: {
            waypoints: [...waypoints.slice(0, index), point, ...waypoints.slice(index)],
            legs: [...legs.slice(0, leg), left, right, ...legs.slice(leg + 1)],
        },
        index,
    };
}

// Опорная точка на линии там, где нажали: на ближайшем звене отрезка leg, а не в ближайшей точке линии (design,
// «Опорная точка — в месте клика на линии»). null — такого отрезка нет.
export function splitLeg(line: RouteLine, leg: number, latlng: LatLng): { line: RouteLine; index: number } | null {
    if (!line.legs[leg]) {
        return null;
    }
    const { link, point } = nearestLink(line, leg, latlng);
    return splitAt(line, leg, link, point);
}

// Опорная точка из места: место на отрезке становится новой опорной точкой
function waypointAt(line: RouteLine, place: LinePlace): { line: RouteLine; index: number } | null {
    if ('waypoint' in place) {
        return line.waypoints[place.waypoint] ? { line, index: place.waypoint } : null;
    }
    return splitLeg(line, place.leg, place.latlng);
}

function slice(line: RouteLine, from: number, to: number): RouteLine {
    return { waypoints: line.waypoints.slice(from, to + 1), legs: line.legs.slice(from, to) };
}

// Cut: две линии, общая точка — конец первой и начало второй. В крайней опорной точке резать нечего — null
// (меню старого клиента Cut у крайних узлов не показывает).
export function cutLine(line: RouteLine, place: LinePlace): [RouteLine, RouteLine] | null {
    const split = waypointAt(line, place);
    if (!split || split.index <= 0 || split.index >= split.line.waypoints.length - 1) {
        return null;
    }
    const last = split.line.waypoints.length - 1;
    return [slice(split.line, 0, split.index), slice(split.line, split.index, last)];
}

function reverseLeg(leg: Leg): Leg {
    return leg.state === 'routed' ? { ...leg, points: leg.points.slice().reverse() } : leg;
}

export function reverseLine(line: RouteLine): RouteLine {
    return {
        waypoints: line.waypoints.slice().reverse(),
        legs: line.legs.map(reverseLeg).reverse(),
    };
}

// Join: к концу end линии приклеивается other своим концом otherEnd, стык — прямой отрезок (joinTrackSegments
// старого клиента)
export function joinLines(line: RouteLine, end: End, other: RouteLine, otherEnd: End): RouteLine {
    if (end === 'end') {
        const tail = otherEnd === 'start' ? other : reverseLine(other);
        return {
            waypoints: [...line.waypoints, ...tail.waypoints],
            legs: [...line.legs, STRAIGHT, ...tail.legs],
        };
    }
    const head = otherEnd === 'end' ? other : reverseLine(other);
    return {
        waypoints: [...head.waypoints, ...line.waypoints],
        legs: [...head.legs, STRAIGHT, ...line.legs],
    };
}

// Положение места среди всех точек линии подряд (toSegment): у точки номер f — ключ 2f, у места на звене между точками
// f и f + 1 — 2f + 1. Между двумя местами удалять есть что, если между их ключами лежит хоть один чётный.
interface Located {
    key: number;
    // опорная точка или место на отрезке: звено и проекция
    waypoint?: number;
    leg?: number;
    link?: number;
    point: LatLng;
}

function locate(line: RouteLine, place: LinePlace): Located | null {
    // номер первой точки каждого отрезка среди всех точек линии
    const target = 'waypoint' in place ? place.waypoint : place.leg;
    let flat = 0;
    for (let i = 0; i < target; i++) {
        const leg = line.legs[i];
        flat += 1 + (leg?.state === 'routed' ? leg.points.length : 0);
    }
    if ('waypoint' in place) {
        const point = line.waypoints[place.waypoint];
        return point ? { key: 2 * flat, waypoint: place.waypoint, point } : null;
    }
    if (!line.legs[place.leg]) {
        return null;
    }
    const { link, point } = nearestLink(line, place.leg, place.latlng);
    return { key: 2 * (flat + link) + 1, leg: place.leg, link, point };
}

function ordered(line: RouteLine, from: LinePlace, to: LinePlace): [Located, Located] | null {
    const a = locate(line, from);
    const b = locate(line, to);
    if (!a || !b) {
        return null;
    }
    const [first, second] = a.key <= b.key ? [a, b] : [b, a];
    // хоть одна точка линии строго между местами: чётный ключ в (first.key, second.key)
    const firstEven = first.key % 2 === 0 ? first.key + 2 : first.key + 1;
    return firstEven < second.key ? [first, second] : null;
}

// Shortcut: участок между двумя местами линии — один прямой отрезок. null — удалять нечего (getShortCutNodes:
// lastNodeToDelete < firstNodeToDelete). Сначала дальнее место становится опорной точкой, потом ближнее: номера
// ближнего от этого не сдвигаются.
export function shortcutLine(line: RouteLine, from: LinePlace, to: LinePlace): RouteLine | null {
    const range = ordered(line, from, to);
    if (!range) {
        return null;
    }
    const [first, second] = range;
    let next = line;
    let end: number;
    if (second.leg !== undefined && second.link !== undefined) {
        const split = splitAt(next, second.leg, second.link, second.point);
        next = split.line;
        end = split.index;
    } else {
        end = second.waypoint ?? 0;
    }
    let start: number;
    if (first.leg !== undefined && first.link !== undefined) {
        const split = splitAt(next, first.leg, first.link, first.point);
        next = split.line;
        start = split.index;
        end += 1;
    } else {
        start = first.waypoint ?? 0;
    }
    return {
        waypoints: [...next.waypoints.slice(0, start + 1), ...next.waypoints.slice(end)],
        legs: [...next.legs.slice(0, start), STRAIGHT, ...next.legs.slice(end)],
    };
}

// Участок, который Shortcut удалит, — для подсветки: от первого места до второго по линии. null — удалять нечего.
export function shortcutRemoved(line: RouteLine, from: LinePlace, to: LinePlace): LatLng[] | null {
    const range = ordered(line, from, to);
    if (!range) {
        return null;
    }
    const [first, second] = range;
    const points: LatLng[] = [first.point];
    let flat = 0;
    const visit = (point: LatLng) => {
        const key = 2 * flat;
        if (key > first.key && key < second.key) {
            points.push(point);
        }
        flat += 1;
    };
    line.waypoints.forEach((waypoint, i) => {
        visit(waypoint);
        const leg = line.legs[i];
        if (leg?.state === 'routed') {
            for (const point of leg.points) {
                visit(point);
            }
        }
    });
    points.push(second.point);
    return points;
}
