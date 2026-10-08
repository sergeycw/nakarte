import { expect, test } from 'vitest';
import { TRACK_LABELS, TRACK_LINES, TRACK_POINTS } from '@/tracks/style';
import { buildCatalog, type LayerDef } from './catalog';
import { BACKGROUND_LAYER, buildStyle, HILLSHADE_PAINT } from './style';

const TRACKS = [TRACK_LINES, TRACK_POINTS, TRACK_LABELS];

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });

function pick(...codes: string[]) {
    return codes.map((code) => catalog.find((layer) => layer.code === code) as LayerDef);
}

test('подложка снизу, оверлеи по порядку наложения, а не по порядку включения', () => {
    const style = buildStyle(pick('Sa', 'Nm', 'Hs', 'O'));
    expect(style.layers.map((layer) => layer.id)).toEqual(['background', 'O', 'Nm', 'Hs', 'Sa', ...TRACKS]);
    expect(Object.keys(style.sources).sort()).toEqual(['Hs', 'Nm', 'O', 'Sa', TRACK_POINTS, TRACK_LINES].sort());
});

test('отмывка — слой hillshade поверх raster-dem', () => {
    const style = buildStyle(pick('O', 'Hs'));
    expect(style.sources.Hs).toMatchObject({ type: 'raster-dem', encoding: 'terrarium' });
    expect(style.layers[2]).toEqual({
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

test('серый фон старого клиента — первым слоем, под подложкой', () => {
    const style = buildStyle(pick('E'));
    expect(style.layers[0]).toEqual(BACKGROUND_LAYER);
    expect(BACKGROUND_LAYER.paint['background-color']).toBe('#ddd');
    expect(style.layers.map((layer) => layer.id)).toEqual(['background', 'E', ...TRACKS]);
});

test('Трек над слоями: линии и точки треков — последними слоями, скрытый трек не рисуется', () => {
    const base = { segments: [], points: [], measureTicksShown: false };
    const style = buildStyle(pick('O', 'Hs'), [
        {
            ...base,
            id: 'a',
            name: 'A',
            color: 1,
            visible: true,
            segments: [
                [
                    { lat: 1, lng: 2 },
                    { lat: 3, lng: 4 },
                ],
            ],
            points: [{ lat: 1, lng: 2, name: 'P' }],
        },
        { ...base, id: 'b', name: 'B', color: 2, visible: false, points: [{ lat: 5, lng: 6, name: 'Q' }] },
    ]);
    expect(style.layers.slice(-3).map((layer) => layer.id)).toEqual(TRACKS);
    expect(style.sources[TRACK_LINES]).toMatchObject({
        data: {
            features: [
                {
                    properties: { id: 'a', color: '#f95' },
                    geometry: {
                        type: 'MultiLineString',
                        coordinates: [
                            [
                                [2, 1],
                                [4, 3],
                            ],
                        ],
                    },
                },
            ],
        },
    });
    expect(style.sources[TRACK_POINTS]).toMatchObject({
        data: { features: [{ properties: { name: 'P', color: '#f95' }, geometry: { coordinates: [2, 1] } }] },
    });
    // подписи без glyphs: MapLibre рисует их локально
    expect(style.glyphs).toBeUndefined();
});
