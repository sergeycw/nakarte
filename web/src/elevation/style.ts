import type { Feature, MultiLineString } from 'geojson';
import type { GeoJSONSourceSpecification, LayerSpecification } from 'maplibre-gl';
import type { LatLng } from '@/tracks/model';

// Выделенный участок профиля на карте (polyLineSelection старого клиента: жёлтая полупрозрачная широкая линия под
// треками). Источник в стиле есть всегда и пустой: данные ставит ProfileOnMap через setData мимо стиля, как превью
// редактора (routing/edit-style.ts) — diff стиля не гоняется на каждое движение мыши.

export const PROFILE_SELECTION = 'elevation-profile-selection';

export const PROFILE_SOURCES: Record<string, GeoJSONSourceSpecification> = {
    [PROFILE_SELECTION]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
};

export const PROFILE_LAYERS: LayerSpecification[] = [
    {
        id: PROFILE_SELECTION,
        type: 'line',
        source: PROFILE_SELECTION,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#ffeb3b', 'line-width': 16, 'line-opacity': 0.6 },
    },
];

// Участок from..to (дробные номера точек выборки) по отрезкам профиля: звено через стык не рисуется
export function selectionFeature(
    points: readonly LatLng[],
    starts: readonly number[],
    from: number,
    to: number,
): Feature<MultiLineString> {
    const lines: number[][][] = [];
    const lo = Math.max(0, Math.min(from, to));
    const hi = Math.min(points.length - 1, Math.max(from, to));
    starts.forEach((start, k) => {
        const end = (starts[k + 1] ?? points.length) - 1;
        const a = Math.max(lo, start);
        const b = Math.min(hi, end);
        if (b <= a) {
            return;
        }
        const coords: number[][] = [lerp(points, a)];
        for (let i = Math.floor(a) + 1; i < b; i++) {
            coords.push([points[i].lng, points[i].lat]);
        }
        coords.push(lerp(points, b));
        lines.push(coords);
    });
    return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } };
}

function lerp(points: readonly LatLng[], index: number): number[] {
    const i = Math.floor(index);
    const q = index - i;
    const a = points[i];
    const b = points[Math.min(i + 1, points.length - 1)];
    return [a.lng + (b.lng - a.lng) * q, a.lat + (b.lat - a.lat) * q];
}
