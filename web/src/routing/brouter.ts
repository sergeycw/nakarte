import { distance, SIMPLIFY_TOLERANCE, simplify, wrapLng } from '@/tracks/geometry';
import type { LatLng } from '@/tracks/model';

// Запрос BRouter и разбор ответа в точки отрезка (спека routing). Перевод src/lib/brouter/index.js старого клиента:
// те же профили, параметры, упрощение и отсев крайних точек, те же тексты ошибок. Движок в браузере и серверный BRouter
// понимают одну и ту же строку запроса и отдают один и тот же GeoJSON (спека browser-routing-engine, «Паритет»).

export interface Activity {
    id: string;
    title: string;
    profile: string;
    // переопределения переменных профиля: profile:<имя>=<значение>
    params?: readonly (readonly [string, number])[];
}

export const ACTIVITIES: readonly Activity[] = [
    { id: 'hiking', title: 'Hiking', profile: 'hiking-mountain' },
    {
        id: 'hiking-trails',
        title: 'Hiking, prefer trails',
        profile: 'hiking-mountain',
        params: [['path_preference', 20]],
    },
    { id: 'road-bike', title: 'Road bike', profile: 'fastbike' },
    { id: 'gravel', title: 'Gravel bike', profile: 'gravel' },
    { id: 'mtb', title: 'Mountain bike', profile: 'mtb' },
    { id: 'touring-bike', title: 'Touring bike', profile: 'trekking' },
];

export function getActivity(id: string | null | undefined): Activity | null {
    return ACTIVITIES.find((activity) => activity.id === id) ?? null;
}

// Крайняя точка маршрута ближе этого к своей опорной отбрасывается: опорная точка соединяется с дорогой без хвостика
const SNAP_DISTANCE = 20;
// BRouter (и движок, и сервер) отвечает так, когда тайла района нет; имя файла пользователю ничего не говорит
const MISSING_TILE_ERROR = /^datafile \S+\.rd5 not found$/u;

// Ошибка прокладки. unreachable — роутер недоступен целиком (сервер не отвечает, движок не запустился): для UI это
// красная кнопка и одно предупреждение, а не «Routing failed» на каждый отрезок.
export class RoutingError extends Error {
    override name = 'RoutingError';
    readonly unreachable: boolean;

    constructor(message: string, unreachable = false) {
        super(MISSING_TILE_ERROR.test(message) ? 'no routing data for this area' : message);
        this.unreachable = unreachable;
    }
}

function lonLat(point: LatLng): string {
    return `${wrapLng(point.lng).toFixed(6)},${point.lat.toFixed(6)}`;
}

// Строка запроса BRouter: основной маршрут (alternativeidx=0) в GeoJSON. Долгота приводится к [−180, 180]:
// у MapLibre есть копии мира, и точку на соседней копии BRouter не поймёт.
export function routeQuery(from: LatLng, to: LatLng, activity: Activity): string {
    const params = new URLSearchParams();
    params.set('lonlats', `${lonLat(from)}|${lonLat(to)}`);
    params.set('profile', activity.profile);
    for (const [name, value] of activity.params ?? []) {
        params.set(`profile:${name}`, String(value));
    }
    params.set('alternativeidx', '0');
    params.set('format', 'geojson');
    return params.toString();
}

// Точки отрезка между опорными from и to (без них самих): ответ сдвигается в ту копию мира, где лежит from,
// упрощается допуском импорта (≈ 2.4 м) и теряет крайние точки ближе 20 м к опорным (buildSegmentNodes старого клиента).
export function parseRoute(geojson: string, from: LatLng, to: LatLng): LatLng[] {
    let coordinates: unknown;
    try {
        coordinates = JSON.parse(geojson)?.features?.[0]?.geometry?.coordinates;
    } catch {
        throw new RoutingError('invalid router response');
    }
    // пустой маршрут — ошибка, а не прямая без пометки (спека browser-routing-engine, «Пустой результат — ошибка»)
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
        throw new RoutingError('no route found');
    }
    let prevLng = from.lng;
    const points = coordinates.map(([lng, lat]: [number, number]) => {
        const shifted = lng + 360 * Math.round((prevLng - lng) / 360);
        prevLng = shifted;
        return { lat, lng: shifted };
    });
    const nodes = simplify(points, SIMPLIFY_TOLERANCE);
    if (nodes.length && distance(from, nodes[0]) < SNAP_DISTANCE) {
        nodes.shift();
    }
    if (nodes.length && distance(to, nodes[nodes.length - 1]) < SNAP_DISTANCE) {
        nodes.pop();
    }
    return nodes;
}
