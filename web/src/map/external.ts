import { type ElevationSource, fetchElevations } from '@/elevation/api';
import type { View } from '@/state/hash';

// «Open this place in» — ExternalMaps старого клиента (src/lib/leaflet.control.external-maps/index.js): адрес сервиса
// с центром и зумом текущего вида. Зум в адресах — старого клиента (Leaflet, 256 px), то есть MapLibre + 1, в пределах
// сервиса. Адреса проверены curl 2026-10-09; mapy.cz заменён конечным mapy.com (старый отвечает 301 туда).

export interface ExternalMap {
    title: string;
    url(view: View, extra: { elevation: number; windowHeight: number }): string;
    // Google Earth ставит камеру над рельефом — ему нужна высота центра
    needsElevation?: boolean;
}

function leafletZoom(view: View, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(view.zoom + 1)));
}

// шесть знаков (≈ 0.1 м) — без шума дробей центра карты
const coordinate = (value: number) => String(Number(value.toFixed(6)));

function simple(title: string, template: string, min: number, max: number): ExternalMap {
    return {
        title,
        url: (view) =>
            template
                .replace('{lat}', coordinate(view.lat))
                .replace('{lng}', coordinate(view.lng))
                .replace('{zoom}', String(leafletZoom(view, min, max))),
    };
}

// Расстояние камеры Google Earth: экран при угле обзора 35° покрывает ту же ширину, что карта на этом зуме
// (GoogleEarthMap.getData старого), плюс высота места
export function googleEarthDistance(view: View, elevation: number, windowHeight: number): number {
    const zoom = leafletZoom(view, 0, 100);
    const earthPerimeter = 40075016;
    const degree = Math.PI / 180;
    const viewAngle = 35;
    const mercatorPixelSize = (earthPerimeter / (256 * 2 ** zoom)) * Math.cos(view.lat * degree);
    const distInPixels = windowHeight / 2 / Math.tan((viewAngle * degree) / 2);
    return distInPixels * mercatorPixelSize + elevation;
}

export const EXTERNAL_MAPS: readonly ExternalMap[] = [
    simple('Google', 'https://www.google.com/maps/@{lat},{lng},{zoom}z', 3, 21),
    simple('Yandex', 'https://yandex.ru/maps/?ll={lng}%2C{lat}&z={zoom}', 2, 21),
    simple('OpenStreetMap', 'https://www.openstreetmap.org/#map={zoom}/{lat}/{lng}', 0, 19),
    {
        title: 'Google Earth 3D',
        needsElevation: true,
        url: (view, { elevation, windowHeight }) =>
            `https://earth.google.com/web/@${coordinate(view.lat)},${coordinate(view.lng)},0a,${googleEarthDistance(view, elevation, windowHeight)}d,35y,0h,0t,0r`,
    },
    simple('Mapy.com', 'https://mapy.com/en/turisticka?x={lng}&y={lat}&z={zoom}', 2, 19),
    simple('Wikimapia', 'https://wikimapia.org/#lat={lat}&lon={lng}&z={zoom}', 3, 22),
    // Meteoblue принимает координаты со знаком и с буквами N и E для всех полушарий (комментарий автора)
    simple('Meteoblue', 'https://www.meteoblue.com/en/weather/week/{lat}N{lng}E', 0, 18),
];

// высота камеры без ответа API высот — как у старого
export const FALLBACK_ELEVATION = 8000;
const ELEVATION_TIMEOUT_MS = 2000;

// Высота центра для Google Earth: не дольше 2 с — окно открывается после ожидания, а браузер разрешает window.open
// только в пределах временной активации после клика
export async function centerElevation(view: View, source: ElevationSource): Promise<number> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), ELEVATION_TIMEOUT_MS);
    try {
        const [value] = await fetchElevations([{ lat: view.lat, lng: view.lng }], source, abort.signal);
        return value ?? FALLBACK_ELEVATION;
    } catch {
        return FALLBACK_ELEVATION;
    } finally {
        clearTimeout(timer);
    }
}

export async function externalMapUrl(
    map: ExternalMap,
    view: View,
    source: ElevationSource,
    windowHeight: number,
): Promise<string> {
    const elevation = map.needsElevation ? await centerElevation(view, source) : FALLBACK_ELEVATION;
    return map.url(view, { elevation, windowHeight });
}
