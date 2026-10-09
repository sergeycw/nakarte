import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { CircleLayerSpecification, GeoJSONSourceSpecification, LayerSpecification } from 'maplibre-gl';
import type { RouteEditState } from '@/state/store';
import type { LatLng } from '@/tracks/model';
import { UNROUTED_PAINT } from '@/tracks/style';
import { legPath } from './line';

// Редактируемая линия на карте (design add-web-route-editor, «Отрисовка»): источники есть в стиле всегда (пустые без
// редактирования), чтобы порядок слоёв был стабильным. Вид — как у старого редактора (edit_line.css): тонкая
// непрозрачная линия цвета трека, опорные точки — белые кружки с тёмной обводкой, начало зелёное, конец красный.
// Ожидающий отрезок не рисуется (разрыв со спиннером), непроложенный — тем же пунктиром, что у треков.
//
// Превью (резинка при рисовании, перетаскиваемая точка с прямыми до соседей) меняется на каждое движение мыши, поэтому
// его источник в стиле всегда пустой, а данные ему ставит MapEditor напрямую (setData), мимо стиля: diff стиля MapLibre
// сравнивает данные всех GeoJSON-источников поэлементно, а у импортированной линии опорных точек тысячи. Любая
// пересборка стиля сбрасывает превью до пустого — следующее движение мыши его вернёт.

export const EDIT_LEGS = 'route-edit-legs';
export const EDIT_LINE = 'route-edit-line';
export const EDIT_UNROUTED = 'route-edit-unrouted';
export const EDIT_PREVIEW = 'route-edit-preview';
export const EDIT_WAYPOINTS = 'route-edit-waypoints';
export const EDIT_PREVIEW_POINT = 'route-edit-preview-point';

const toCoordinates = (line: readonly LatLng[]) => line.map((p) => [p.lng, p.lat]);

function collection<T extends Feature>(features: T[]): GeoJSONSourceSpecification {
    return { type: 'geojson', data: { type: 'FeatureCollection', features } };
}

// drag — номер перетаскиваемой опорной точки: её и её отрезки рисует превью
export function editSources(
    edit: RouteEditState | null,
    color: string,
    drag: number | null,
): Record<string, GeoJSONSourceSpecification> {
    const legs: Feature<LineString>[] = [];
    const waypoints: Feature<Point>[] = [];
    if (edit) {
        const { line } = edit;
        line.legs.forEach((leg, index) => {
            if (leg.state === 'pending' || (drag !== null && (index === drag - 1 || index === drag))) {
                return;
            }
            legs.push({
                type: 'Feature',
                properties: { leg: index, state: leg.state, color, unrouted: leg.state === 'failed' },
                geometry: { type: 'LineString', coordinates: toCoordinates(legPath(line, index)) },
            });
        });
        line.waypoints.forEach((point, index) => {
            if (index === drag) {
                return;
            }
            waypoints.push({
                type: 'Feature',
                properties: { index, role: waypointRole(index, line.waypoints.length) },
                geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
            });
        });
    }
    return {
        [EDIT_LEGS]: collection(legs),
        [EDIT_PREVIEW]: collection([]),
        [EDIT_WAYPOINTS]: collection(waypoints),
    };
}

export function waypointRole(index: number, count: number): 'start' | 'end' | 'middle' {
    return index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle';
}

// Данные превью: прямые и, при перетаскивании, сама точка (рисуется как опорная)
export function previewData(
    lines: readonly (readonly LatLng[])[],
    color: string,
    point?: { latlng: LatLng; role: string },
): FeatureCollection {
    const features: Feature[] = lines.map((line) => ({
        type: 'Feature',
        properties: { color },
        geometry: { type: 'LineString', coordinates: toCoordinates(line) },
    }));
    if (point) {
        features.push({
            type: 'Feature',
            properties: { role: point.role },
            geometry: { type: 'Point', coordinates: [point.latlng.lng, point.latlng.lat] },
        });
    }
    return { type: 'FeatureCollection', features };
}

// Выбор на карте для Join и Shortcut (design add-web-line-tools, «Выбор на карте»): линия от начала к курсору — зелёный
// пунктир над допустимым местом, красный над недопустимым (lineCursorValidStyle/InvalidStyle старого клиента), участок,
// который Shortcut удалит, — красная линия
export const TOOL_VALID = '#16a34a';
export const TOOL_INVALID = '#e11d48';

export function toolPreviewData(band: readonly LatLng[], valid: boolean, removed: readonly LatLng[] | null = null) {
    const lines = [{ path: band, color: valid ? TOOL_VALID : TOOL_INVALID }];
    if (removed) {
        lines.unshift({ path: removed, color: TOOL_INVALID });
    }
    return {
        type: 'FeatureCollection' as const,
        features: lines.map(({ path, color }) => ({
            type: 'Feature' as const,
            properties: { color },
            geometry: { type: 'LineString' as const, coordinates: toCoordinates(path) },
        })),
    };
}

const WAYPOINT_PAINT = {
    'circle-radius': 6,
    'circle-color': ['match', ['get', 'role'], 'start', '#33bf33', 'end', '#e63333', '#fff'],
    'circle-stroke-color': '#333',
    'circle-stroke-width': 2,
} as const satisfies CircleLayerSpecification['paint'];

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
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2] },
    },
    { id: EDIT_WAYPOINTS, type: 'circle', source: EDIT_WAYPOINTS, paint: WAYPOINT_PAINT },
    {
        id: EDIT_PREVIEW_POINT,
        type: 'circle',
        source: EDIT_PREVIEW,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: WAYPOINT_PAINT,
    },
];
