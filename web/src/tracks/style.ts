import type { Feature, LineString, Point } from 'geojson';
import type { GeoJSONSourceSpecification, LayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import type { SegmentRoute } from '@/routing/line';
import { type LatLng, TRACK_COLORS, type Track } from './model';

// Треки на карте (design add-web-tracks, «Треки на карте»): GeoJSON-источники на все треки, над всеми слоями.
// Линия — непрозрачная цвета трека над белой обводкой (design map-chrome): полупрозрачная линия старого клиента
// (weight 6, opacity 0.5) терялась на спутнике и Strava heatmap. Подписи точек MapLibre рисует сам,
// без glyphs в стиле: шрифт из text-font берётся как CSS-семейство (GlyphManager MapLibre 6). id источников и слоёв не
// пересекаются с кодами слоёв каталога и своих слоёв (-cs…).
//
// Фича линии — кусок одного отрезка трека (id трека и номер отрезка в свойствах: по ним клик начинает редактирование).
// Разметка маршрута режет отрезок на куски (design add-web-route-editor, «Отрисовка»): ожидающий отрезок — разрыв со
// спиннером в середине, непроложенный — красный пунктир в слое tracks-unrouted вместо линии трека. Редактируемый
// отрезок рисует редактор (routing/edit-style.ts), здесь его нет.

export const TRACK_LINES = 'tracks';
// обводка линий: тот же источник, слой под линиями; клики ищут только TRACK_LINES (MapEditor)
export const TRACK_CASING = 'tracks-casing';
export const TRACK_UNROUTED = 'tracks-unrouted';
// обводка пунктира непроложенного отрезка: пометка ошибки не должна теряться на спутнике сильнее линии трека
export const TRACK_UNROUTED_CASING = 'tracks-unrouted-casing';
export const TRACK_POINTS = 'track-points';
export const TRACK_LABELS = 'track-labels';
// отметки расстояния (tracks/ticks.ts): источник собирает карта на целом зуме
export const TRACK_TICKS = 'track-ticks';

// пометка непроложенного отрезка (решение владельца 2026-10-09: красный пунктир всегда, и вне редактирования)
export const UNROUTED_COLOR = '#e11d48';

export interface SegmentRef {
    trackId: string;
    segment: number;
}

export interface SegmentPieces {
    // куски линии без ожидающих и непроложенных отрезков
    lines: LatLng[][];
    // непроложенные отрезки: прямая между опорными точками
    unrouted: [LatLng, LatLng][];
}

export function segmentPieces(points: readonly LatLng[], route: SegmentRoute | null | undefined): SegmentPieces {
    const pieces: SegmentPieces = { lines: [], unrouted: [] };
    if (!route) {
        pieces.lines.push(points.slice());
        return pieces;
    }
    let current: LatLng[] = [];
    const flush = () => {
        if (current.length > 1) {
            pieces.lines.push(current);
        }
        current = [];
    };
    route.legs.forEach((leg, k) => {
        const from = route.waypoints[k];
        const to = route.waypoints[k + 1];
        const a = points[from];
        const b = points[to];
        if (!a || !b) {
            return;
        }
        // ожидающий отрезок — разрыв без маркера: ожидание показывает курсор (спека route-editing, «Разрыв на
        // ожидающем отрезке»)
        if (leg.state === 'pending' || leg.state === 'failed') {
            flush();
            if (leg.state === 'failed') {
                pieces.unrouted.push([a, b]);
            }
            return;
        }
        const slice = points.slice(from, to + 1);
        current.push(...(current.length ? slice.slice(1) : slice));
    });
    flush();
    return pieces;
}

const toCoordinates = (line: readonly LatLng[]) => line.map((p) => [p.lng, p.lat]);

function line(coordinates: readonly LatLng[], properties: Record<string, unknown>): Feature<LineString> {
    return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates: toCoordinates(coordinates) } };
}

// Источники треков. skip — редактируемый отрезок: его рисует редактор.
export function trackSources(
    tracks: readonly Track[],
    skip: SegmentRef | null = null,
): { sources: Record<string, GeoJSONSourceSpecification> } {
    const visible = tracks.filter((track) => track.visible);
    const lines: Feature<LineString>[] = [];
    const unrouted: Feature<LineString>[] = [];
    for (const track of visible) {
        const color = TRACK_COLORS[track.color];
        track.segments.forEach((points, segment) => {
            const pieces = segmentPieces(points, track.routes?.[segment]);
            if (skip && skip.trackId === track.id && skip.segment === segment) {
                return;
            }
            for (const piece of pieces.lines) {
                if (piece.length > 1) {
                    lines.push(line(piece, { id: track.id, segment, color }));
                }
            }
            for (const pair of pieces.unrouted) {
                unrouted.push(line(pair, { id: track.id, segment }));
            }
        });
    }
    const points: Feature<Point>[] = visible.flatMap((track) =>
        // index — номер точки в треке: по нему клик открывает меню точки (design add-web-line-tools)
        track.points.map((point, index) => ({
            type: 'Feature' as const,
            properties: { id: track.id, index, color: TRACK_COLORS[track.color], name: point.name },
            geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
        })),
    );
    return {
        sources: {
            [TRACK_LINES]: { type: 'geojson', data: { type: 'FeatureCollection', features: lines } },
            [TRACK_UNROUTED]: { type: 'geojson', data: { type: 'FeatureCollection', features: unrouted } },
            [TRACK_POINTS]: { type: 'geojson', data: { type: 'FeatureCollection', features: points } },
            // данные отметок зависят от зума — их ставит карта (BaseMap); здесь источник пустой, чтобы слой был всегда
            [TRACK_TICKS]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
    };
}

// пунктир непроложенного отрезка: line-dasharray — в ширинах линии
export const UNROUTED_PAINT: LineLayerSpecification['paint'] = {
    'line-color': UNROUTED_COLOR,
    'line-width': 3,
    'line-dasharray': [2, 1.5],
};

// Белая обводка шире линии на 1.5 px с каждой стороны: на светлой карте её почти не видно, на тёмной (спутник, heatmap)
// она отделяет линию от фона
export const CASING_COLOR = '#fff';
// под пунктиром — сплошная: белые промежутки между штрихами
export const UNROUTED_CASING_PAINT: LineLayerSpecification['paint'] = { 'line-color': CASING_COLOR, 'line-width': 6 };
const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };

export const TRACK_LAYERS: LayerSpecification[] = [
    {
        id: TRACK_CASING,
        type: 'line',
        source: TRACK_LINES,
        layout: LINE_LAYOUT,
        paint: { 'line-color': CASING_COLOR, 'line-width': 7 },
    },
    {
        id: TRACK_LINES,
        type: 'line',
        source: TRACK_LINES,
        layout: LINE_LAYOUT,
        paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
    },
    {
        id: TRACK_UNROUTED_CASING,
        type: 'line',
        source: TRACK_UNROUTED,
        paint: UNROUTED_CASING_PAINT,
    },
    {
        id: TRACK_UNROUTED,
        type: 'line',
        source: TRACK_UNROUTED,
        paint: UNROUTED_PAINT,
    },
    // Подпись поперёк линии с отступом от неё (.measure-tick-icon-text старого: padding-left 0.7em, жирный 10 px, белый
    // ореол); поверх всех подписей и не вытесняет их — отметки разнесены шагом не меньше 15 мм
    {
        id: TRACK_TICKS,
        type: 'symbol',
        source: TRACK_TICKS,
        layout: {
            'text-field': ['get', 'label'],
            'text-font': ['sans-serif'],
            'text-size': 11,
            'text-anchor': 'left',
            'text-offset': [0.7, 0],
            'text-rotate': ['get', 'rotate'],
            'text-rotation-alignment': 'map',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
        },
        paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    },
    {
        id: TRACK_POINTS,
        type: 'circle',
        source: TRACK_POINTS,
        paint: {
            'circle-radius': 5,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
        },
    },
    {
        id: TRACK_LABELS,
        type: 'symbol',
        source: TRACK_POINTS,
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['sans-serif'],
            'text-size': 12,
            'text-anchor': 'left',
            'text-offset': [0.8, 0],
        },
        paint: { 'text-color': '#222', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    },
];
