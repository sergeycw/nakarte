import type { GeoJSONSourceSpecification, LayerSpecification } from 'maplibre-gl';
import { TRACK_COLORS, type Track } from './model';

// Треки на карте (design add-web-tracks, «Треки на карте»): два GeoJSON-источника на все треки, над всеми слоями.
// Вид линии — TrackSegment старого клиента (weight 6, opacity 0.5, lineCap round). Подписи точек MapLibre рисует сам,
// без glyphs в стиле: шрифт из text-font берётся как CSS-семейство (GlyphManager MapLibre 6). id источников и слоёв не
// пересекаются с кодами слоёв каталога и своих слоёв (-cs…).

export const TRACK_LINES = 'tracks';
export const TRACK_POINTS = 'track-points';
export const TRACK_LABELS = 'track-labels';

export function trackSources(tracks: readonly Track[]): Record<string, GeoJSONSourceSpecification> {
    const visible = tracks.filter((track) => track.visible);
    return {
        [TRACK_LINES]: {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: visible
                    .filter((track) => track.segments.length > 0)
                    .map((track) => ({
                        type: 'Feature',
                        properties: { id: track.id, color: TRACK_COLORS[track.color] },
                        geometry: {
                            type: 'MultiLineString',
                            coordinates: track.segments.map((line) => line.map((p) => [p.lng, p.lat])),
                        },
                    })),
            },
        },
        [TRACK_POINTS]: {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: visible.flatMap((track) =>
                    track.points.map((point) => ({
                        type: 'Feature' as const,
                        properties: { id: track.id, color: TRACK_COLORS[track.color], name: point.name },
                        geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
                    })),
                ),
            },
        },
    };
}

export const TRACK_LAYERS: LayerSpecification[] = [
    {
        id: TRACK_LINES,
        type: 'line',
        source: TRACK_LINES,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.5 },
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
