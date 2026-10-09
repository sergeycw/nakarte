import type { Feature, FeatureCollection, Point } from 'geojson';
import { distance } from './geometry';
import type { LatLng, Track } from './model';

// Отметки расстояния вдоль отрезков (design add-web-search-panoramas, «Отметки расстояния и линейка») — L.MeasuredLine
// старого клиента (src/lib/leaflet.polyline-measure/index.js): на каждый отрезок от его начала, шаг — первый из ряда не
// меньше 15 мм экрана, подпись поперёк линии.

const STEPS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
const MIN_TICKS_INTERVAL_MM = 15;
const DPI = 96;
// 20003931 / project([180, 0]).x старого — половина окружности меридиана на половину ширины мира; у MapLibre мир на z0 —
// 512 px
const MERIDIAN = 2 * 20003931;
const RAD = Math.PI / 180;
const EARTH_RADIUS = 6378137;

// метров на 15 мм экрана на этой широте при зуме MapLibre (updateTicks старого)
export function minTickInterval(zoom: number, lat: number): number {
    const metersPerPixel = (MERIDIAN / (512 * 2 ** zoom)) * Math.cos(lat * RAD);
    const mapScale = ((1 / DPI) * 2.54) / 100 / metersPerPixel;
    return MIN_TICKS_INTERVAL_MM / mapScale / 1000;
}

// первый шаг ряда не меньше интервала, иначе — последний (цикл getTicksPositions старого)
export function tickStep(minInterval: number): number {
    return STEPS.find((step) => step >= minInterval) ?? STEPS[STEPS.length - 1];
}

export interface Tick {
    lat: number;
    lng: number;
    // метры от начала отрезка
    distance: number;
    // поворот подписи по часовой стрелке, градусы
    rotate: number;
}

function mercatorY(lat: number): number {
    return EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

// Поворот подписи поперёк звена — transformMatrix старого (sinCosFromLatLonSegment в Меркаторе, CSS matrix), как угол:
// матрица [a, b, c, d] поворота — [cos θ, sin θ, −sin θ, cos θ]
function rotation(a: LatLng, b: LatLng): number {
    const dx = (b.lng - a.lng) * RAD * EARTH_RADIUS;
    const dy = mercatorY(a.lat) - mercatorY(b.lat);
    const length = Math.hypot(dx, dy);
    if (!length) {
        return 0;
    }
    const sin = dy / length;
    const cos = dx / length;
    const [m0, m1] = sin > 0 ? [sin, -cos] : [-sin, cos];
    return Math.atan2(m1, m0) / RAD;
}

// FIXME автора: точка — по прямой в градусах, а не по проекции
function pointAt(a: LatLng, b: LatLng, offset: number): LatLng {
    const q = offset / distance(a, b);
    return { lat: a.lat + (b.lat - a.lat) * q, lng: a.lng + (b.lng - a.lng) * q };
}

export function segmentTicks(points: readonly LatLng[], minInterval: number): Tick[] {
    if (points.length < 2) {
        return [];
    }
    const step = tickStep(minInterval);
    const ticks: Tick[] = [];
    const add = (at: LatLng, from: LatLng, to: LatLng, value: number) =>
        ticks.push({ lat: at.lat, lng: at.lng, distance: value, rotate: rotation(from, to) });
    let lastTick = 0;
    let lastPoint = 0;
    for (let i = 1; i < points.length; i++) {
        const next = lastPoint + distance(points[i - 1], points[i]);
        while (lastTick + step <= next) {
            lastTick += step;
            add(pointAt(points[i - 1], points[i], lastTick - lastPoint), points[i - 1], points[i], lastTick);
        }
        lastPoint = next;
    }
    // последняя отметка близко к концу — убрать
    if (lastPoint - lastTick < minInterval / 2) {
        ticks.pop();
    }
    // очень короткий отрезок — без нулевой отметки
    if (lastPoint > minInterval / 2) {
        add(points[0], points[0], points[1], 0);
    }
    add(points[points.length - 1], points[points.length - 2], points[points.length - 1], lastPoint);
    return ticks;
}

// подпись старого: round(d / 10) / 100 km
export function tickLabel(meters: number): string {
    return `${Math.round(meters / 10) / 100} km`;
}

function middleLat(points: readonly LatLng[]): number {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const { lat } of points) {
        min = Math.min(min, lat);
        max = Math.max(max, lat);
    }
    return (min + max) / 2;
}

const NO_TICKS: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

// Отметки видимых треков с measureTicksShown на целом зуме MapLibre; масштаб — по середине границ отрезка. Без отметок —
// один и тот же пустой объект: стиль карты не пересобирается на каждом шаге зума
export function ticksData(tracks: readonly Track[], zoom: number): FeatureCollection<Point> {
    if (!tracks.some((track) => track.visible && track.measureTicksShown)) {
        return NO_TICKS;
    }
    const features: Feature<Point>[] = [];
    for (const track of tracks) {
        if (!track.visible || !track.measureTicksShown) {
            continue;
        }
        for (const points of track.segments) {
            if (points.length < 2) {
                continue;
            }
            for (const tick of segmentTicks(points, minTickInterval(zoom, middleLat(points)))) {
                features.push({
                    type: 'Feature',
                    properties: { label: tickLabel(tick.distance), rotate: tick.rotate },
                    geometry: { type: 'Point', coordinates: [tick.lng, tick.lat] },
                });
            }
        }
    }
    return features.length ? { type: 'FeatureCollection', features } : NO_TICKS;
}
