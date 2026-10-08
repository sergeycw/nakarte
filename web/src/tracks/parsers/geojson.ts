import { type GeoData, type GeoError, geoData, type LatLng, type Waypoint } from '../model';
import { decode } from './text';

// GeoJSON FeatureCollection (parsers/geojson.js старого клиента): Point — точки, LineString — отрезки. Отличия:
// не JSON или без массива features — формат не наш (null), у старого — CORRUPT на любой нераспознанный файл;
// MultiLineString — отрезками (design add-web-tracks, «Парсеры»); фича без геометрии пропускается.

interface Feature {
    geometry?: { type?: string; coordinates?: unknown } | null;
    properties?: Record<string, unknown> | null;
}

function position(value: unknown): LatLng | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const [lng, lat] = value;
    return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

export function parseGeojson(bytes: Uint8Array, name: string): GeoData[] | null {
    let json: { features?: unknown };
    try {
        json = JSON.parse(decode(bytes));
    } catch {
        return null;
    }
    if (!json || !Array.isArray(json.features)) {
        return null;
    }
    let error: GeoError | undefined;
    const segments: LatLng[][] = [];
    const points: Waypoint[] = [];

    function addLine(coordinates: unknown) {
        const line: LatLng[] = [];
        for (const item of Array.isArray(coordinates) ? coordinates : []) {
            const point = position(item);
            if (!point) {
                error = 'CORRUPT';
                continue;
            }
            line.push(point);
        }
        if (line.length < 2) {
            error = 'CORRUPT';
            return;
        }
        segments.push(line);
    }

    for (const feature of json.features as Feature[]) {
        const geometry = feature?.geometry;
        if (geometry?.type === 'Point') {
            const point = position(geometry.coordinates);
            if (!point) {
                error = 'CORRUPT';
                continue;
            }
            const pointName = feature.properties?.name;
            points.push({ ...point, name: pointName === undefined || pointName === null ? '' : String(pointName) });
        } else if (geometry?.type === 'LineString') {
            addLine(geometry.coordinates);
        } else if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
            geometry.coordinates.forEach(addLine);
        }
    }
    return [geoData(name, { segments, points, error })];
}
