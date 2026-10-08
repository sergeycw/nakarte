import type { LatLng } from './model';

// Геометрия треков без карты. Формулы — как в Leaflet 1.0.3 старого клиента, чтобы длины, упрощение и ссылки
// совпадали с ним: CRS.Earth (R = 6 371 000 м, сферический закон косинусов), LineUtil.simplify (отсев по радиусу +
// Дуглас — Пекер) в градусах, как L.LineUtil.simplifyLatlngs (src/lib/leaflet.lineutil.simplifyLatLngs).

const EARTH_RADIUS = 6371000;
const RAD = Math.PI / 180;

// Допуск упрощения при импорте и в ссылках — шаг сетки nktk (arcUnit = (2^24 − 1) / 360), ≈ 2.4 м
export const SIMPLIFY_TOLERANCE = 360 / (1 << 24);

export function distance(a: LatLng, b: LatLng): number {
    const lat1 = a.lat * RAD;
    const lat2 = b.lat * RAD;
    const cos = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos((b.lng - a.lng) * RAD);
    return EARTH_RADIUS * Math.acos(Math.min(cos, 1));
}

export function lineLength(line: readonly LatLng[]): number {
    let length = 0;
    for (let i = 1; i < line.length; i++) {
        length += distance(line[i - 1], line[i]);
    }
    return length;
}

const lengthCache = new WeakMap<readonly (readonly LatLng[])[], number>();

// Длина трека кешируется по ссылке на массив отрезков: стор меняет массив целиком при любой правке
export function tracksLength(segments: readonly (readonly LatLng[])[]): number {
    let length = lengthCache.get(segments);
    if (length === undefined) {
        length = segments.reduce((sum, line) => sum + lineLength(line), 0);
        lengthCache.set(segments, length);
    }
    return length;
}

// formatLength старого клиента
export function formatLength(meters: number): string {
    const digits = meters < 10000 ? 2 : meters < 100000 ? 1 : 0;
    return `${(meters / 1000).toFixed(digits)} km`;
}

function sqDist(a: LatLng, b: LatLng) {
    const dx = a.lng - b.lng;
    const dy = a.lat - b.lat;
    return dx * dx + dy * dy;
}

function sqDistToSegment(p: LatLng, a: LatLng, b: LatLng) {
    let x = a.lng;
    let y = a.lat;
    const dx = b.lng - x;
    const dy = b.lat - y;
    const dot = dx * dx + dy * dy;
    if (dot > 0) {
        const t = ((p.lng - x) * dx + (p.lat - y) * dy) / dot;
        if (t > 1) {
            x = b.lng;
            y = b.lat;
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }
    return (p.lng - x) ** 2 + (p.lat - y) ** 2;
}

// L.LineUtil.simplify. Дуглас — Пекер — стеком, а не рекурсией: большой GPX с прямой линией иначе упирается в стек.
export function simplify<T extends LatLng>(points: readonly T[], tolerance = SIMPLIFY_TOLERANCE): T[] {
    if (!tolerance || points.length === 0) {
        return points.slice();
    }
    const sqTolerance = tolerance * tolerance;

    const reduced = [points[0]];
    let prev = 0;
    for (let i = 1; i < points.length; i++) {
        if (sqDist(points[i], points[prev]) > sqTolerance) {
            reduced.push(points[i]);
            prev = i;
        }
    }
    if (prev < points.length - 1) {
        reduced.push(points[points.length - 1]);
    }

    const markers = new Uint8Array(reduced.length);
    markers[0] = 1;
    markers[reduced.length - 1] = 1;
    const stack: [number, number][] = [[0, reduced.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop() as [number, number];
        let maxSqDist = 0;
        let index = 0;
        for (let i = first + 1; i < last; i++) {
            const d = sqDistToSegment(reduced[i], reduced[first], reduced[last]);
            if (d > maxSqDist) {
                index = i;
                maxSqDist = d;
            }
        }
        if (maxSqDist > sqTolerance) {
            markers[index] = 1;
            stack.push([index, last], [first, index]);
        }
    }
    return reduced.filter((_, i) => markers[i]);
}

// LatLng.wrap() Leaflet: wrapNum(lng, [-180, 180], includeMax) — ровно 180 остаётся 180
export function wrapLng(lng: number): number {
    return lng === 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
}

// unwrapLatLngsCrossing180Meridian старого клиента: каждая следующая точка берётся в той копии мира, что ближе к
// предыдущей, — линия через 180° остаётся непрерывной (долгота может выйти за ±180, MapLibre это рисует)
export function unwrapLine(line: readonly LatLng[]): LatLng[] {
    const result: LatLng[] = [];
    for (const point of line) {
        const prev = result.at(-1);
        if (!prev) {
            result.push({ lat: point.lat, lng: point.lng });
            continue;
        }
        const lng = point.lng + 360 * Math.round((prev.lng - point.lng) / 360);
        result.push({ lat: point.lat, lng });
    }
    return result;
}

// Линия при добавлении в список (addTracksFromGeodataArray старого клиента): развернуть через 180°, упростить,
// одну точку повторить — линия из одной точки иначе не рисуется и не редактируется
export function normalizeLine(line: readonly LatLng[]): LatLng[] {
    const simplified = simplify(unwrapLine(line));
    if (simplified.length === 1) {
        simplified.push({ ...simplified[0] });
    }
    return simplified;
}

function splitLat(a: LatLng, b: LatLng, lng: number) {
    return a.lat + ((b.lat - a.lat) / (b.lng - a.lng)) * (lng - a.lng);
}

function positiveLng(lng: number) {
    return ((lng % 360) + 360) % 360;
}

// splitLinesAt180Meridian старого клиента (meridian180.js): для экспорта долготы приводятся к [−180, 180), а отрезок,
// который пересекает 180°, делится на два с точками в 0.000001° от меридиана по обе стороны
export function splitAt180(line: readonly LatLng[]): LatLng[][] {
    if (line.length < 2) {
        return [];
    }
    const wrapped = line.map((p) => ({ lat: p.lat, lng: wrapLng(p.lng) }));
    const lines: LatLng[][] = [[wrapped[0]]];
    for (let i = 1; i < wrapped.length; i++) {
        const point = wrapped[i];
        const prev = wrapped[i - 1];
        const current = lines[lines.length - 1];
        if (Math.abs(point.lng - prev.lng) <= 180) {
            current.push(point);
            continue;
        }
        const a = { lat: prev.lat, lng: positiveLng(prev.lng) };
        const b = { lat: point.lat, lng: positiveLng(point.lng) };
        const splitLng = 180 - 0.000001 * Math.sign(point.lng);
        const splitPrevLng = 180 - 0.000001 * Math.sign(prev.lng);
        current.push({ lat: splitLat(a, b, splitPrevLng), lng: wrapLng(splitPrevLng) });
        lines.push([{ lat: splitLat(a, b, splitLng), lng: wrapLng(splitLng) }, point]);
    }
    return lines;
}

export function splitLinesAt180(lines: readonly (readonly LatLng[])[]): LatLng[][] {
    return lines.flatMap(splitAt180);
}

export interface Bounds {
    west: number;
    south: number;
    east: number;
    north: number;
}

export function boundsOf(points: Iterable<LatLng>): Bounds | null {
    let bounds: Bounds | null = null;
    for (const { lat, lng } of points) {
        if (!bounds) {
            bounds = { west: lng, south: lat, east: lng, north: lat };
            continue;
        }
        bounds.west = Math.min(bounds.west, lng);
        bounds.east = Math.max(bounds.east, lng);
        bounds.south = Math.min(bounds.south, lat);
        bounds.north = Math.max(bounds.north, lat);
    }
    return bounds;
}
