// Модель трека нового приложения (design add-web-tracks, «Модель трека»). Формы данных повторяют geodata старого
// клиента (src/lib/leaflet.control.track-list/lib/parsers/): парсеры файлов, ссылки и импорт по ссылкам отдают
// GeoData, список треков хранит Track.

import type { SegmentRoute } from '@/routing/line';

export interface LatLng {
    lat: number;
    lng: number;
}

export interface Waypoint extends LatLng {
    name: string;
}

export interface TrackData {
    name: string;
    segments: LatLng[][];
    points: Waypoint[];
    // индекс в TRACK_COLORS; без него — следующий цвет по кругу
    color?: number;
    hidden?: boolean;
    // отметки расстояния на линии; рисует их линейка (change 8), здесь флаг только переживает ссылки
    measureTicksShown?: boolean;
    // разметка маршрута по отрезкам (routing/line.ts): routes[i] — для segments[i], null — обычная ломаная. Файлы и
    // ссылки её пока не несут (change 6), поэтому из парсеров и ссылок трек приходит без неё.
    routes?: readonly (SegmentRoute | null)[];
}

// Коды ошибок старого клиента; любая другая строка — готовый текст с подстановкой {name}
export type GeoError = 'CORRUPT' | 'UNSUPPORTED' | 'NETWORK' | 'INVALID_URL' | (string & {});

export interface GeoData extends TrackData {
    error?: GeoError;
}

export interface Track extends TrackData {
    id: string;
    color: number;
    visible: boolean;
}

// TRACKLIST_TRACK_COLORS старого клиента: цвет в ссылках nktk — индекс в этом списке
export const TRACK_COLORS = ['#77f', '#f95', '#0ff', '#f77', '#f7f', '#ee5'] as const;

export function geoData(name: string, fields: Partial<GeoData> = {}): GeoData {
    return { name, segments: [], points: [], ...fields };
}

export function isEmpty(data: TrackData): boolean {
    return data.segments.length === 0 && data.points.length === 0;
}
