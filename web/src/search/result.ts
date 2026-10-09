import type { Bounds } from '@/tracks/geometry';
import type { LatLng } from '@/tracks/model';

// Результат поиска любого источника (design add-web-search-panoramas, «Модули»). Карта переходит на bounds, если они
// есть, иначе — на latlng с zoom; zoom — в единицах MapLibre (старый зум − 1, подвох про зум в AGENTS.md).
export interface SearchResult {
    title: string;
    // категория и адрес места; у координат и ссылок — null
    subtitle: string | null;
    latlng: LatLng;
    bounds: Bounds | null;
    zoom: number | null;
}

export type SearchResponse = { results: SearchResult[] } | { error: string };

// зум 17 старого клиента — результат без границ у поисковиков и координаты
export const PLACE_ZOOM = 16;

// зум старого клиента (Leaflet, мир на z0 — 256 px) → зум MapLibre
export function fromLeafletZoom(zoom: number): number {
    return Math.max(0, zoom - 1);
}
