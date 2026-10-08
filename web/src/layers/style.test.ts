import { expect, test } from 'vitest';
import { buildCatalog, type LayerDef } from './catalog';
import { buildStyle, HILLSHADE_PAINT } from './style';

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });

function pick(...codes: string[]) {
    return codes.map((code) => catalog.find((layer) => layer.code === code) as LayerDef);
}

test('подложка снизу, оверлеи по порядку наложения, а не по порядку включения', () => {
    const style = buildStyle(pick('Sa', 'Nm', 'Hs', 'O'));
    expect(style.layers.map((layer) => layer.id)).toEqual(['O', 'Nm', 'Hs', 'Sa']);
    expect(Object.keys(style.sources).sort()).toEqual(['Hs', 'Nm', 'O', 'Sa']);
});

test('отмывка — слой hillshade поверх raster-dem', () => {
    const style = buildStyle(pick('O', 'Hs'));
    expect(style.sources.Hs).toMatchObject({ type: 'raster-dem', encoding: 'terrarium' });
    expect(style.layers[1]).toEqual({
        id: 'Hs',
        type: 'hillshade',
        source: 'Hs',
        paint: HILLSHADE_PAINT,
    });
    // без белой подсветки: она высветляет подложку
    expect(HILLSHADE_PAINT['hillshade-highlight-color']).toMatch(/, 0\)$/);
});

test('прозрачность Strava и минимальный зум региональных слоёв', () => {
    const style = buildStyle(pick('O', 'Sa', 'Gbt'));
    expect(style.layers.find((layer) => layer.id === 'Sa')).toMatchObject({ paint: { 'raster-opacity': 0.75 } });
    expect(style.layers.find((layer) => layer.id === 'Gbt')).toMatchObject({ minzoom: 11 });
    expect(style.layers.find((layer) => layer.id === 'O')).toEqual({ id: 'O', type: 'raster', source: 'O' });
});

test('атрибуция — в источниках, MapLibre собирает её в подпись карты', () => {
    const style = buildStyle(pick('O', 'Wh'));
    expect(style.sources.O).toHaveProperty('attribution', expect.stringContaining('OpenStreetMap'));
    expect(style.sources.Wh).toHaveProperty('attribution', expect.stringContaining('Waymarked Hiking Trails'));
});

test('прежняя подложка — под новой, пока новая грузится', () => {
    const [osm, esri, wh] = pick('O', 'E', 'Wh');
    expect(buildStyle([esri, wh], osm).layers.map((layer) => layer.id)).toEqual(['O', 'E', 'Wh']);
    // та же подложка второй раз не добавляется
    expect(buildStyle([esri, wh], esri).layers.map((layer) => layer.id)).toEqual(['E', 'Wh']);
});
