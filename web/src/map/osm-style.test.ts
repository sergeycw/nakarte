import { expect, test } from 'vitest';
import { OSM_SOURCE_ID, osmStyle } from './osm-style';

test('стиль OSM: один растровый источник с атрибуцией', () => {
    const style = osmStyle('https://tile.example/{z}/{x}/{y}.png');
    expect(style.sources[OSM_SOURCE_ID]).toMatchObject({
        type: 'raster',
        tiles: ['https://tile.example/{z}/{x}/{y}.png'],
        tileSize: 256,
    });
    expect(style.sources[OSM_SOURCE_ID]).toHaveProperty('attribution', expect.stringContaining('OpenStreetMap'));
    expect(style.layers).toEqual([{ id: OSM_SOURCE_ID, type: 'raster', source: OSM_SOURCE_ID }]);
});
