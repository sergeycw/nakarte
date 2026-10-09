import type { Feature, LineString, Point } from 'geojson';
import type { GeoJSONSourceSpecification, LayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import type { SegmentRoute } from '@/routing/line';
import { type LatLng, TRACK_COLORS, type Track } from './model';

// Треки на карте (design add-web-tracks, «Треки на карте»): GeoJSON-источники на все треки, над всеми слоями.
// Вид линии — TrackSegment старого клиента (weight 6, opacity 0.5, lineCap round). Подписи точек MapLibre рисует сам,
// без glyphs в стиле: шрифт из text-font берётся как CSS-семейство (GlyphManager MapLibre 6). id источников и слоёв не
// пересекаются с кодами слоёв каталога и своих слоёв (-cs…).
//
// Фича линии — кусок одного отрезка трека (id трека и номер отрезка в свойствах: по ним клик начинает редактирование).
// Разметка маршрута режет отрезок на куски (design add-web-route-editor, «Отрисовка»): ожидающий отрезок — разрыв со
// спиннером в середине, непроложенный — красный пунктир в слое tracks-unrouted вместо линии трека. Редактируемый
// отрезок рисует редактор (routing/edit-style.ts), здесь его нет.

export const TRACK_LINES = 'tracks';
export const TRACK_UNROUTED = 'tracks-unrouted';
export const TRACK_POINTS = 'track-points';
export const TRACK_LABELS = 'track-labels';

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
    // середины ожидающих отрезков: там спиннер
    pending: LatLng[];
}

export function segmentPieces(points: readonly LatLng[], route: SegmentRoute | null | undefined): SegmentPieces {
    const pieces: SegmentPieces = { lines: [], unrouted: [], pending: [] };
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
        if (leg.state === 'pending' || leg.state === 'failed') {
            flush();
            if (leg.state === 'pending') {
                pieces.pending.push({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });
            } else {
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

// Источники треков. skip — редактируемый отрезок: его рисует редактор. pending — середины ожидающих отрезков всех
// видимых треков (спиннеры-маркеры карты).
export function trackSources(
    tracks: readonly Track[],
    skip: SegmentRef | null = null,
): { sources: Record<string, GeoJSONSourceSpecification>; pending: LatLng[] } {
    const visible = tracks.filter((track) => track.visible);
    const lines: Feature<LineString>[] = [];
    const unrouted: Feature<LineString>[] = [];
    const pending: LatLng[] = [];
    for (const track of visible) {
        const color = TRACK_COLORS[track.color];
        track.segments.forEach((points, segment) => {
            const pieces = segmentPieces(points, track.routes?.[segment]);
            pending.push(...pieces.pending);
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
        track.points.map((point) => ({
            type: 'Feature' as const,
            properties: { id: track.id, color: TRACK_COLORS[track.color], name: point.name },
            geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
        })),
    );
    return {
        sources: {
            [TRACK_LINES]: { type: 'geojson', data: { type: 'FeatureCollection', features: lines } },
            [TRACK_UNROUTED]: { type: 'geojson', data: { type: 'FeatureCollection', features: unrouted } },
            [TRACK_POINTS]: { type: 'geojson', data: { type: 'FeatureCollection', features: points } },
        },
        pending,
    };
}

// пунктир непроложенного отрезка: line-dasharray — в ширинах линии
export const UNROUTED_PAINT: LineLayerSpecification['paint'] = {
    'line-color': UNROUTED_COLOR,
    'line-width': 3,
    'line-dasharray': [2, 1.5],
};

export const TRACK_LAYERS: LayerSpecification[] = [
    {
        id: TRACK_LINES,
        type: 'line',
        source: TRACK_LINES,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.5 },
    },
    {
        id: TRACK_UNROUTED,
        type: 'line',
        source: TRACK_UNROUTED,
        paint: UNROUTED_PAINT,
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
