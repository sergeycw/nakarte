import type { Feature, LineString, Point } from 'geojson';
import type { GeoJSONSourceSpecification, LayerSpecification } from 'maplibre-gl';
import type { RouteEditState, RoutePreview } from '@/state/store';
import type { LatLng } from '@/tracks/model';
import { UNROUTED_PAINT } from '@/tracks/style';
import { legPath } from './line';

// Редактируемая линия на карте (design add-web-route-editor, «Отрисовка»): источники есть в стиле всегда (пустые без
// редактирования), чтобы порядок слоёв был стабильным. Вид — как у старого редактора (edit_line.css): тонкая
// непрозрачная линия цвета трека, опорные точки — белые кружки с тёмной обводкой, начало зелёное, конец красный.
// Ожидающий отрезок не рисуется (разрыв со спиннером), непроложенный — тем же пунктиром, что у треков.

export const EDIT_LEGS = 'route-edit-legs';
export const EDIT_LINE = 'route-edit-line';
export const EDIT_UNROUTED = 'route-edit-unrouted';
// прозрачная широкая линия: нажатие на неё вставляет опорную точку
export const EDIT_HIT = 'route-edit-hit';
export const EDIT_PREVIEW = 'route-edit-preview';
export const EDIT_WAYPOINTS = 'route-edit-waypoints';

const toCoordinates = (line: readonly LatLng[]) => line.map((p) => [p.lng, p.lat]);

function collection<T extends Feature>(features: T[]): GeoJSONSourceSpecification {
    return { type: 'geojson', data: { type: 'FeatureCollection', features } };
}

export function editSources(
    edit: RouteEditState | null,
    color: string,
    preview: RoutePreview | null,
): Record<string, GeoJSONSourceSpecification> {
    const legs: Feature<LineString>[] = [];
    const waypoints: Feature<Point>[] = [];
    const previewLines: Feature<LineString>[] = [];
    if (edit) {
        const { line } = edit;
        const drag = preview?.drag;
        line.legs.forEach((leg, index) => {
            // перетаскиваемая точка тянет за собой резинки до соседей, её прежние отрезки не рисуются
            if (leg.state === 'pending' || (drag && (index === drag.index - 1 || index === drag.index))) {
                return;
            }
            legs.push({
                type: 'Feature',
                properties: { leg: index, color, unrouted: leg.state === 'failed' },
                geometry: { type: 'LineString', coordinates: toCoordinates(legPath(line, index)) },
            });
        });
        const last = line.waypoints.length - 1;
        line.waypoints.forEach((point, index) => {
            const at = drag?.index === index ? drag.latlng : point;
            waypoints.push({
                type: 'Feature',
                properties: { index, role: index === 0 ? 'start' : index === last ? 'end' : 'middle' },
                geometry: { type: 'Point', coordinates: [at.lng, at.lat] },
            });
        });
        for (const lineString of preview?.lines ?? []) {
            previewLines.push({
                type: 'Feature',
                properties: { color },
                geometry: { type: 'LineString', coordinates: toCoordinates(lineString) },
            });
        }
    }
    return {
        [EDIT_LEGS]: collection(legs),
        [EDIT_PREVIEW]: collection(previewLines),
        [EDIT_WAYPOINTS]: collection(waypoints),
    };
}

export const EDIT_LAYERS: LayerSpecification[] = [
    {
        id: EDIT_LINE,
        type: 'line',
        source: EDIT_LEGS,
        filter: ['!', ['get', 'unrouted']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 },
    },
    { id: EDIT_UNROUTED, type: 'line', source: EDIT_LEGS, filter: ['get', 'unrouted'], paint: UNROUTED_PAINT },
    {
        id: EDIT_PREVIEW,
        type: 'line',
        source: EDIT_PREVIEW,
        paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2] },
    },
    {
        id: EDIT_HIT,
        type: 'line',
        source: EDIT_LEGS,
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 14 },
    },
    {
        id: EDIT_WAYPOINTS,
        type: 'circle',
        source: EDIT_WAYPOINTS,
        paint: {
            'circle-radius': 6,
            'circle-color': ['match', ['get', 'role'], 'start', '#33bf33', 'end', '#e63333', '#fff'],
            'circle-stroke-color': '#333',
            'circle-stroke-width': 2,
        },
    },
];
