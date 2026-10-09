import { PLACE_ZOOM, type SearchResult } from './result';

// Поиск mapy.cz (MapyCzProvider старого клиента, src/lib/leaflet.control.search/providers/mapycz): подсказки
// pro.mapy.cz/suggest/ через CORS-прокси клона. Ответ — сохранённый в fixtures/mapycz-mtatsminda.json (2026-10-09):
// result[].userData с suggestFirstRow (название), suggestSecondRow (категория и адрес на языке lang), latitude,
// longitude и bbox [lat, lng, lat, lng]. Иконки категорий (api.mapy.cz/poiimg) и таблица категорий старого не нужны:
// вторая строка уже несёт категорию (design add-web-search-panoramas, «Поиск по названию»).

export const MAPYCZ_SUGGEST_URL = 'https://pro.mapy.cz/suggest/';
export const MAPYCZ_ATTRIBUTION = { text: 'Mapy.com', url: 'https://mapy.com' };

const LANGUAGES = ['en', 'cs', 'de', 'pl', 'sk', 'ru', 'es', 'fr'];
export const RESULTS_LIMIT = 5;

// языки браузера из поддерживаемых, без повторов (getRequestLanguages старого)
export function browserLanguages(languages: readonly string[], supported: readonly string[]): string[] {
    const codes = languages.map((lang) => lang.split('-')[0]).filter((lang) => supported.includes(lang));
    return [...new Set(codes)];
}

export interface PlaceQuery {
    query: string;
    lat: number;
    lng: number;
    // зум MapLibre
    zoom: number;
    languages: readonly string[];
}

export function mapyczUrl(corsProxyUrl: string, { query, lat, lng, zoom, languages }: PlaceQuery): string {
    const url = new URL(MAPYCZ_SUGGEST_URL);
    url.searchParams.append('phrase', query);
    url.searchParams.append('lat', String(lat));
    url.searchParams.append('lon', String(lng));
    // зум старого клиента — его ждёт mapy.cz
    url.searchParams.append('zoom', String(Math.round(zoom + 1)));
    // у старого без подходящих языков параметр уходил пустым; интерфейс английский — пусть будет en
    url.searchParams.append('lang', browserLanguages(languages, LANGUAGES).join(',') || 'en');
    url.searchParams.append('count', String(RESULTS_LIMIT));
    return corsProxyUrl + url.href.replace(/^https:\/\//u, 'https/');
}

interface MapyczItem {
    userData?: {
        suggestFirstRow?: string;
        suggestSecondRow?: string;
        suggestThirdRow?: string;
        latitude?: number;
        longitude?: number;
        bbox?: number[];
    };
}

export class SearchResponseError extends Error {}

export function parseMapycz(json: unknown): SearchResult[] {
    const items = (json as { result?: unknown })?.result;
    if (!Array.isArray(items)) {
        throw new SearchResponseError('unexpected response');
    }
    return (items as MapyczItem[])
        .map((item) => item.userData)
        .filter((data) => data && data.suggestSecondRow !== 'Poloha')
        .flatMap((data): SearchResult[] => {
            const lat = Number(data?.latitude);
            const lng = Number(data?.longitude);
            if (!data || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                return [];
            }
            const bbox = data.bbox?.length === 4 && data.bbox.every(Number.isFinite) ? data.bbox : null;
            return [
                {
                    title: data.suggestFirstRow ?? '',
                    subtitle: data.suggestSecondRow || data.suggestThirdRow || null,
                    latlng: { lat, lng },
                    bounds: bbox
                        ? {
                              south: Math.min(bbox[0], bbox[2]),
                              north: Math.max(bbox[0], bbox[2]),
                              west: Math.min(bbox[1], bbox[3]),
                              east: Math.max(bbox[1], bbox[3]),
                          }
                        : null,
                    zoom: bbox ? null : PLACE_ZOOM,
                },
            ];
        });
}
