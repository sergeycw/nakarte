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
    // разметка маршрута по отрезкам (routing/line.ts): routes[i] — для segments[i], null — обычная ломаная. Её несут
    // ссылка nktk (поле route отрезка) и автосохранение, а файлы GPX/KML — нет (design add-web-autosave).
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

// Цвет в ссылках nktk — индекс в этом списке (TRACKLIST_TRACK_COLORS старого клиента: синий, оранжевый, голубой,
// красный, розовый, жёлтый). Порядок оттенков — старый, значения насыщеннее (design map-chrome): бледные цвета старого
// клиента на непрозрачной линии с белой обводкой терялись на светлой карте. Индексы не менять — их несут ссылки.
export const TRACK_COLORS = ['#2563eb', '#f97316', '#0891b2', '#ef4444', '#d946ef', '#eab308'] as const;

export function geoData(name: string, fields: Partial<GeoData> = {}): GeoData {
    return { name, segments: [], points: [], ...fields };
}

export function isEmpty(data: TrackData): boolean {
    return data.segments.length === 0 && data.points.length === 0;
}
