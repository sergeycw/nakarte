import { type GeoData, type GeoError, geoData, type LatLng, type Waypoint } from '../model';
import { decodeXml } from './text';
import { elements, nodeText, parseXml } from './xml';
import { unzip } from './zip-entries';

// KML и KMZ (parsers/kml.js старого клиента): LineString и gx:Track — отрезки, Placemark с Point — точки.

interface KmlContent {
    segments: LatLng[][];
    points: Waypoint[];
    error?: GeoError;
}

function parseKmlContent(text: string): KmlContent | null {
    const dom = parseXml(text);
    if (!dom || elements(dom, 'kml').length === 0) {
        return null;
    }
    let error: GeoError | undefined;
    const segments: LatLng[][] = [];

    for (const lineString of elements(dom, 'LineString')) {
        const coordinates = elements(lineString, 'coordinates')[0];
        if (!coordinates) {
            continue;
        }
        const line: LatLng[] = [];
        for (const tuple of (nodeText(coordinates) ?? '').split(/\s+/u)) {
            if (!tuple) {
                continue;
            }
            const [lng, lat] = tuple.split(',').map(Number.parseFloat);
            if (Number.isNaN(lat) || Number.isNaN(lng) || lat === undefined) {
                error = 'CORRUPT';
                break;
            }
            line.push({ lat, lng });
        }
        if (line.length) {
            segments.push(line);
        }
    }

    // gx:Track — после LineString, как в старом клиенте; префикс снят parseXml
    for (const track of elements(dom, 'gx_Track')) {
        const line: LatLng[] = [];
        for (const coord of elements(track, 'gx_coord')) {
            const [lng, lat] = (nodeText(coord) ?? '').trim().split(/\s+/u).map(Number);
            if (Number.isNaN(lat) || Number.isNaN(lng) || lat === undefined) {
                error = 'CORRUPT';
                break;
            }
            line.push({ lat, lng });
        }
        if (line.length) {
            segments.push(line);
        }
    }

    const points: Waypoint[] = [];
    for (const placemark of elements(dom, 'Placemark')) {
        const pointElements = elements(placemark, 'Point');
        if (pointElements.length === 0) {
            continue;
        }
        const coordinates = pointElements.length === 1 ? elements(pointElements[0], 'coordinates') : [];
        const [lng, lat] =
            coordinates.length === 1 ? (nodeText(coordinates[0]) ?? '').split(',').map(Number.parseFloat) : [];
        if (lat === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
            error = 'CORRUPT';
            break;
        }
        points.push({ lat, lng, name: nodeText(elements(placemark, 'name')[0]) ?? '' });
    }
    return { segments, points, error };
}

export function parseKml(bytes: Uint8Array, name: string): GeoData[] | null {
    const content = parseKmlContent(decodeXml(bytes));
    return content && [geoData(name, content)];
}

// KMZ — ZIP с doc.kml: все .kml архива — один трек с именем файла. У старого клиента parseKmz всегда возвращал null
// (default-импорт вендорного js-unzip через webpack — объект модуля, не конструктор), и KMZ открывался веткой ZIP
// по треку на каждый .kml (fixtures/README.md); здесь — один трек, как задумано в старом коде.
export function parseKmz(bytes: Uint8Array, name: string): GeoData[] | null {
    const entries = unzip(bytes);
    if (!entries?.some((entry) => entry.name === 'doc.kml')) {
        return null;
    }
    const result = geoData(name);
    for (const entry of entries) {
        if (!/\.kml$/iu.test(entry.name)) {
            continue;
        }
        const content = parseKmlContent(decodeXml(entry.data));
        if (content) {
            result.error ??= content.error;
            result.segments.push(...content.segments);
            result.points.push(...content.points);
        }
    }
    return [result];
}
