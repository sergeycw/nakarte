import { describe, expect, test } from 'vitest';
import { buildCatalog, type LayerDef } from './catalog';

const PROXY = 'https://proxy.test/';
const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: PROXY });
const byCode = new Map(catalog.map((layer) => [layer.code, layer]));

function quadkey(z: number, x: number, y: number) {
    let key = '';
    for (let i = z; i > 0; i--) {
        const mask = 1 << (i - 1);
        key += ((x & mask ? 1 : 0) + (y & mask ? 2 : 0)).toString();
    }
    return key;
}

// подстановка токенов как в TileID.url MapLibre 6.13 (src/tile/tile_id.ts)
function tileUrl(layer: LayerDef, z: number, x: number, y: number, pixelRatio = 1) {
    const tiles = layer.source.tiles ?? [];
    return tiles[(x + y) % tiles.length]
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y))
        .replace('{ratio}', pixelRatio > 1 ? '@2x' : '')
        .replace('{quadkey}', quadkey(z, x, y));
}

// Образцы — шаблоны src/layers.js, подставленные Leaflet для тайла 8/151/87 (или тайла в покрытии слоя).
// Отличия от старого клиента намеренные: Google — z= вместо zoom=17-z (те же тайлы), Slazav и Slovakia — конечные
// адреса после редиректа, swisstopo — без прокси, Bing — статичный адрес из стиля.
const SAMPLES: [code: string, tile: [number, number, number], url: string][] = [
    ['O', [8, 151, 87], 'https://tile.openstreetmap.org/8/151/87.png'],
    ['Co', [8, 151, 87], 'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/8/151/87.png'],
    ['E', [8, 151, 87], 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/8/87/151'],
    ['G', [8, 151, 87], 'https://mt2.google.com/vt/lyrs=m@169000000&hl=en&x=151&y=87&z=8'],
    ['Gh', [8, 151, 87], 'https://mt2.google.com/vt/lyrs=h@169000000&hl=en&x=151&y=87&z=8'],
    ['L', [8, 151, 87], 'https://mt2.google.com/vt/lyrs=s&x=151&y=87&z=8'],
    ['P', [8, 151, 87], 'https://mt2.google.com/vt/lyrs=t@130,r@206000000&hl=en&x=151&y=87&z=8'],
    ['I', [3, 4, 2], 'https://t.ssl.ak.tiles.virtualearth.net/tiles/a120.jpeg?g=15625&n=z&prx=1'],
    ['Q', [10, 634, 377], 'https://tiles.slazav.xyz/hr/10/634/377.png'],
    ['Z', [10, 619, 320], 'https://tiles.slazav.xyz/podm/10/619/320.png'],
    ['Otm', [8, 151, 87], 'https://b.tile.opentopomap.org/8/151/87.png'],
    ['Ocm', [8, 151, 87], 'https://b.tile.thunderforest.com/cycle/8/151/87.png'],
    ['Oso', [8, 151, 87], 'https://b.tile.thunderforest.com/outdoors/8/151/87.png'],
    ['Mt', [8, 182, 94], 'https://proxy.test/https/maptiles.website.yandexcloud.net/8/182/94.png'],
    ['Ot', [8, 151, 87], 'https://b.gps-tile.openstreetmap.org/lines/8/151/87.png'],
    [
        'Sa',
        [8, 151, 87],
        'https://proxy.test/https/content-a.strava.com/identified/globalheat/all/hot/8/151/87.png?px=256',
    ],
    [
        'Sr',
        [8, 151, 87],
        'https://proxy.test/https/content-a.strava.com/identified/globalheat/run/hot/8/151/87.png?px=256',
    ],
    [
        'Sb',
        [8, 151, 87],
        'https://proxy.test/https/content-a.strava.com/identified/globalheat/ride/hot/8/151/87.png?px=256',
    ],
    [
        'Sw',
        [8, 151, 87],
        'https://proxy.test/https/content-a.strava.com/identified/globalheat/winter/hot/8/151/87.png?px=256',
    ],
    ['Np', [8, 136, 70], 'https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/8/70/136.png'],
    ['Nm', [8, 136, 70], 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/8/70/136.png'],
    ['Nr', [8, 136, 70], 'https://maptiles1.finncdn.no/tileService/1.0.3/normap/8/136/70.png'],
    [
        'Fmk',
        [8, 145, 70],
        'https://proxy.laji.fi/mml_wmts/maasto/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/8/70/145.png',
    ],
    [
        'Gbt',
        [3, 3, 2],
        'https://t.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/031?mkt=&ur=ge&it=G,OS,BF,RL&og=2866&sv=9.48&n=t&o=webp,95&cstl=s23',
    ],
    ['Wc', [8, 151, 87], 'https://tile.waymarkedtrails.org/cycling/8/151/87.png'],
    ['Wh', [8, 151, 87], 'https://tile.waymarkedtrails.org/hiking/8/151/87.png'],
    ['St', [10, 564, 352], 'https://tile.mapy.hiking.sk/otm/10/564/352.png'],
    [
        'Sp',
        [8, 126, 97],
        'https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS' +
            '&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix=8&TileCol=126&TileRow=97',
    ],
    [
        'Si',
        [9, 267, 180],
        'https://wmts10.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/9/267/180.jpeg',
    ],
    [
        'Se',
        [8, 140, 73],
        'https://minkarta.lantmateriet.se/map/topowebbcache?layer=topowebb&style=default&tilematrixset=3857' +
            '&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix=8&TileCol=140&TileRow=73',
    ],
    ['Hs', [8, 151, 87], 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/8/151/87.png'],
];

describe('Каталог слоёв', () => {
    test('Список слоёв: 30 слоёв старого клиента и отмывка, без Яндекса, Wikimapia и сетки', () => {
        expect(catalog).toHaveLength(31);
        for (const code of ['Y', 'S', 'W', 'Ng']) {
            expect(byCode.has(code)).toBe(false);
        }
        expect(byCode.get('Hs')?.title).toBe('Relief shading');
    });

    test('нет слоёв на данных автора и адресов nakarte.me', () => {
        const removed = ['T', 'D', 'N', 'A', 'J', 'C', 'F', 'B', 'K', 'U', 'R', 'E25m', 'NT1', 'NT5', 'T25', 'MN25'];
        for (const code of [...removed, 'Pur', 'Wp', 'Gc', 'Czt', 'Czw']) {
            expect(byCode.has(code)).toBe(false);
        }
        expect(JSON.stringify(catalog)).not.toMatch(/nakarte\.me/);
    });

    test('коды уникальны, у каждого слоя атрибуция и место в порядке наложения', () => {
        expect(new Set(catalog.map((layer) => layer.code)).size).toBe(catalog.length);
        expect(new Set(catalog.map((layer) => layer.order)).size).toBe(catalog.length);
        for (const layer of catalog) {
            expect(layer.source.attribution, layer.code).toMatch(/<a href="https?:\/\//);
        }
    });

    test('подложки — как в старом клиенте, остальное — оверлеи', () => {
        const bases = catalog.filter((layer) => !layer.isOverlay).map((layer) => layer.code);
        expect(bases.sort()).toEqual(['Co', 'E', 'G', 'I', 'L', 'O', 'Ocm', 'Oso', 'Otm', 'P']);
    });

    test('порядок наложения: топокарты под отмывкой, отмывка под линейными слоями', () => {
        const order = (code: string) => byCode.get(code)?.order ?? 0;
        expect(order('Nm')).toBeLessThan(order('Hs'));
        expect(order('Z')).toBeLessThan(order('Hs'));
        expect(order('Hs')).toBeLessThan(order('Gh'));
        expect(order('Hs')).toBeLessThan(order('Sa'));
        expect(order('O')).toBeLessThan(order('Nr'));
    });

    test('у каждого слоя каталога есть образец адреса', () => {
        expect(SAMPLES.map(([code]) => code).sort()).toEqual(catalog.map((layer) => layer.code).sort());
    });

    test.each(SAMPLES)('адрес тайла %s', (code, [z, x, y], expected) => {
        const layer = byCode.get(code);
        expect(layer).toBeDefined();
        expect(tileUrl(layer as LayerDef, z, x, y)).toBe(expected);
    });

    test('retina: Strava 512 px на зум меньше, Thunderforest @2x', () => {
        const retina = buildCatalog({ pixelRatio: 2, language: 'en', corsProxyUrl: PROXY });
        const sa = retina.find((layer) => layer.code === 'Sa') as LayerDef;
        expect(sa.source.tiles?.[0]).toMatch(/px=512$/);
        expect(sa.source.maxzoom).toBe(15);
        expect(byCode.get('Sa')?.source.maxzoom).toBe(16);
        const ocm = retina.find((layer) => layer.code === 'Ocm') as LayerDef;
        expect(tileUrl(ocm, 8, 151, 87, 2)).toBe('https://b.tile.thunderforest.com/cycle/8/151/87@2x.png');
    });

    test('язык подписей Google кодируется в адресе', () => {
        const ru = buildCatalog({ pixelRatio: 1, language: 'ru-RU', corsProxyUrl: PROXY });
        expect(ru.find((layer) => layer.code === 'G')?.source.tiles?.[0]).toContain('hl=ru-RU&');
    });

    test('Слой Strava и Tsvetkov — через прокси, остальные напрямую', () => {
        const proxied = catalog.filter((layer) => layer.source.tiles?.[0].startsWith(PROXY)).map((l) => l.code);
        expect(proxied.sort()).toEqual(['Mt', 'Sa', 'Sb', 'Sr', 'Sw']);
    });

    test('региональные слои: прямоугольник покрытия и минимальный зум', () => {
        for (const code of ['Np', 'Nm', 'Nr', 'Fmk', 'Se', 'Gbt', 'St', 'Sp', 'Si', 'Mt']) {
            expect(byCode.get(code)?.source.bounds, code).toHaveLength(4);
        }
        // зум карты MapLibre = зум Leaflet - 1: Great Britain Topo с Leaflet 12, Slovakia — с 10
        expect(byCode.get('Gbt')?.minZoom).toBe(11);
        expect(byCode.get('St')?.minZoom).toBe(9);
        expect(byCode.get('Si')?.source.tileSize).toBe(128);
    });

    test('отмывка — raster-dem Terrarium до z15', () => {
        expect(byCode.get('Hs')?.source).toMatchObject({ type: 'raster-dem', encoding: 'terrarium', maxzoom: 15 });
        expect(byCode.get('Hs')?.isOverlay).toBe(true);
    });
});
