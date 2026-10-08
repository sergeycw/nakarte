import type { StyleSpecification } from 'maplibre-gl';

export const OSM_SOURCE_ID = 'osm';

// Растровый OpenStreetMap — подложка по умолчанию до change add-outdoor-basemap (record-new-ui-decisions).
// Адрес тайлов — параметр, чтобы тесты подставляли локальную фикстуру вместо tile.openstreetmap.org.
export function osmStyle(tileUrl: string): StyleSpecification {
    return {
        version: 8,
        sources: {
            [OSM_SOURCE_ID]: {
                type: 'raster',
                tiles: [tileUrl],
                tileSize: 256,
                maxzoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
        },
        layers: [{ id: OSM_SOURCE_ID, type: 'raster', source: OSM_SOURCE_ID }],
    };
}
