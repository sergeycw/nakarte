import type { RasterDEMSourceSpecification, RasterSourceSpecification } from 'maplibre-gl';

// Каталог растровых слоёв нового приложения — данные старого src/layers.js, переведённые в источники MapLibre
// (design add-web-map-layers, «Каталог»). Без Яндекса (Y, S: EPSG:3395), Wikimapia (W) и сетки Ng — решения
// владельца (record-new-ui-decisions). Модуль без импортов приложения: его же импортирует e2e (Node), чтобы
// знать, какие тайлы подменять фикстурой.
//
// Перевод опций Leaflet: зум карты MapLibre на 1 меньше Leaflet, нумерация тайлов та же. Поэтому maxNativeZoom
// переходит в maxzoom источника как есть (без него — 18: старая карта выше maxZoom 18 не поднималась), а minZoom
// слоя — в minZoom - 1. cutline отброшен, остаётся прямоугольник bounds.

export type LayerSource = RasterSourceSpecification | RasterDEMSourceSpecification;

export interface LayerDef {
    // код в l= и в leafletLayersSettings — тот же, что у старого клиента
    code: string;
    title: string;
    group: string;
    // порядок наложения снизу вверх (titlesByOrder старого клиента)
    order: number;
    isOverlay: boolean;
    // показывать в переключателе без настроек пользователя (isDefault старого клиента)
    isDefault: boolean;
    source: LayerSource;
    // зум карты MapLibre, с которого слой виден
    minZoom?: number;
    opacity?: number;
}

export interface CatalogEnv {
    // > 1 — retina-варианты тайлов, как L.Browser.retina у RetinaTileLayer
    pixelRatio: number;
    // язык подписей Google (hl=), как navigator.language у leaflet.layer.google
    language: string;
    corsProxyUrl: string;
}

// Формат адреса прокси — urlViaCorsProxy старого клиента: <прокси>https/host/path
export function viaCorsProxy(corsProxyUrl: string, url: string): string {
    return corsProxyUrl + url.replace(/^(https?):\/\//u, '$1/');
}

// {s} Leaflet → массив адресов: MapLibre сам выбирает адрес по (x + y) % длина
function subdomains(template: string, letters = 'abc'): string[] {
    return [...letters].map((s) => template.replace('{s}', s));
}

const DEFAULT_MAX_ZOOM = 18;

export const GROUPS = [
    'Default layers',
    'OpenStreetMap alternatives',
    'Topo maps',
    'Miscellaneous',
    'Routes and traces',
    'Norway',
] as const;

// titlesByOrder старого клиента; места своих слоёв — CUSTOM_BOTTOM и CUSTOM_TOP. Отмывка рельефа — над непрозрачными
// картами-оверлеями и под линейными, чтобы тени ложились на любую подложку и не закрывали тропы.
const ORDER = [
    'Tt',
    'O',
    'Co',
    'Otm',
    'Ocm',
    'Oso',
    'E',
    'L',
    'I',
    'G',
    'P',
    '#custom-bottom',
    'Nr',
    'Np',
    'Nm',
    'Fmk',
    'Se',
    'St',
    'Sp',
    'Mt',
    'Q',
    'Gbt',
    'Si',
    'Z',
    '#custom-top',
    'Hs',
    'Gh',
    'Wh',
    'Wc',
    'Ot',
    'Sa',
    'Sr',
    'Sb',
    'Sw',
];

export const CUSTOM_BOTTOM_ORDER = ORDER.indexOf('#custom-bottom') + 1;
export const CUSTOM_TOP_ORDER = ORDER.indexOf('#custom-top') + 1;

const OSM_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>';
// «Maps © Tracestrack» — подпись из условий Tracestrack (ресёрч new-ui, 2026-10-08), данные — OSM
const TRACESTRACK_ATTRIBUTION = `<a href="https://www.tracestrack.com/">Maps &copy; Tracestrack</a>, ${OSM_ATTRIBUTION}`;
const STRAVA_ATTRIBUTION = '<a href="https://www.strava.com/heatmap">Strava Global Heatmap</a>';
const KARTVERKET_ATTRIBUTION = '<a href="https://kartverket.no/til-lands/kart/turkart">Kartverket</a>';
const GOOGLE_ATTRIBUTION = '<a href="https://www.google.com/maps">Google</a>';
const GOOGLE_SAT_ATTRIBUTION =
    '<a href="https://www.google.com/maps/@43.0668619,60.5738071,13622628m/data=!3m1!1e3">Google</a>';
const SLAZAV_ATTRIBUTION = '<a href="http://slazav.xyz/maps">Vladislav Zavjalov</a>';
// Полный список источников DEM (11 пунктов) — по ссылке: joerd/docs/attribution.md требует атрибуцию «в разумном
// для носителя месте», правила OSMF, на которые он ссылается, допускают ссылку на страницу с полной атрибуцией.
const TERRAIN_ATTRIBUTION =
    '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen, sources</a>';

// [west, south, east, north]; значения — bounds старого каталога ([[south, west], [north, east]])
const NORWAY_BOUNDS: [number, number, number, number] = [4.19674, 57.81324, 31.56094, 71.27961];

type Def = Omit<LayerDef, 'order'>;

function raster(
    tiles: string[],
    attribution: string,
    options: Omit<RasterSourceSpecification, 'type' | 'tiles' | 'attribution'> = {},
): RasterSourceSpecification {
    return { type: 'raster', tiles, tileSize: 256, maxzoom: DEFAULT_MAX_ZOOM, attribution, ...options };
}

function googleTiles(lyrs: string, language: string) {
    // Google с z={z} отдаёт те же тайлы, что старый zoom={17 - z} (проверено побайтно 2026-10-08), поэтому
    // хватает токенов MapLibre без transformRequest
    return subdomains(
        `https://mt{s}.google.com/vt/lyrs=${lyrs}&hl=${encodeURIComponent(language)}&x={x}&y={y}&z={z}`,
        '0123',
    );
}

function stravaLayer(code: string, kind: string, title: string, env: CatalogEnv): Def {
    // retina — тайл 512 px в 256 CSS px и на зум меньше, как retinaOptionsOverrides старого слоя
    const hiRes = env.pixelRatio > 1;
    const url = `https://content-a.strava.com/identified/globalheat/${kind}/hot/{z}/{x}/{y}.png?px=${hiRes ? 512 : 256}`;
    return {
        code,
        title,
        group: 'Routes and traces',
        isOverlay: true,
        isDefault: false,
        opacity: 0.75,
        source: raster([viaCorsProxy(env.corsProxyUrl, url)], STRAVA_ATTRIBUTION, { maxzoom: hiRes ? 15 : 16 }),
    };
}

function definitions(env: CatalogEnv): Def[] {
    return [
        {
            code: 'Tt',
            title: 'Tracestrack Topo',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            // подложка по умолчанию (design add-outdoor-basemap). Только через прокси: ключ API — секрет Worker'а прокси,
            // в адресе клиента его нет (workers/cors-proxy/src/tracestrack.js). Адрес и maxZoom 19 — как у слоя
            // openstreetmap.org; topo__ — без перевода подписей; {ratio} — @2x на экранах от 2x, тот же кредит квоты
            source: raster(
                [viaCorsProxy(env.corsProxyUrl, 'https://tile.tracestrack.com/topo__/{z}/{x}/{y}{ratio}.webp')],
                TRACESTRACK_ATTRIBUTION,
                { maxzoom: 19 },
            ),
        },
        {
            code: 'O',
            title: 'OpenStreetMap',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            source: raster(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], OSM_ATTRIBUTION),
        },
        {
            code: 'Co',
            title: 'CyclOSM',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            source: raster(
                subdomains('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'),
                `${OSM_ATTRIBUTION}. Tiles style by <a href="https://www.cyclosm.org/">CyclOSM</a>`,
            ),
        },
        {
            code: 'E',
            title: 'ESRI Satellite',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            source: raster(
                ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                '<a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">' +
                    'ESRI World Imagery for ArcGIS</a>',
            ),
        },
        {
            code: 'G',
            title: 'Google Map',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            source: raster(googleTiles('m@169000000', env.language), GOOGLE_ATTRIBUTION),
        },
        {
            code: 'Gh',
            title: 'Google Hybrid',
            group: 'Miscellaneous',
            isOverlay: true,
            isDefault: false,
            source: raster(googleTiles('h@169000000', env.language), GOOGLE_SAT_ATTRIBUTION),
        },
        {
            code: 'L',
            title: 'Google Satellite',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            source: raster(
                subdomains('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', '0123'),
                GOOGLE_SAT_ATTRIBUTION,
            ),
        },
        {
            code: 'P',
            title: 'Google Terrain',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            source: raster(
                googleTiles('t@130,r@206000000', env.language),
                '<a href="https://www.google.com/maps/@43.1203575,42.1105049,9.58z/data=!5m1!1e4">Google</a>',
            ),
        },
        {
            code: 'I',
            title: 'Bing Satellite',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            // адрес из bing.com/maps/style?styleid=aerial; без g= тайл отвечает 400, с любым g — тот же тайл,
            // поэтому адрес статичный, без запроса стиля, как делал старый BingSatLayer
            source: raster(
                ['https://t.ssl.ak.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=15625&n=z&prx=1'],
                '<a href="https://www.bing.com/maps?style=h">Microsoft</a>',
            ),
        },
        {
            code: 'Q',
            title: 'Slazav mountains',
            group: 'Default layers',
            isOverlay: true,
            isDefault: true,
            // slazav.xyz/tiles/hr/{x}-{y}-{z}.png отвечает 302 сюда без CORS-заголовка, а WebGL нужен CORS на
            // каждом ответе цепочки — поэтому сразу конечный адрес
            source: raster(['https://tiles.slazav.xyz/hr/{z}/{x}/{y}.png'], SLAZAV_ATTRIBUTION, { maxzoom: 13 }),
        },
        {
            code: 'Z',
            title: 'Slazav Moscow region map',
            group: 'Default layers',
            isOverlay: true,
            isDefault: true,
            source: raster(['https://tiles.slazav.xyz/podm/{z}/{x}/{y}.png'], SLAZAV_ATTRIBUTION, { maxzoom: 14 }),
        },
        {
            code: 'Otm',
            title: 'OpenTopoMap',
            group: 'OpenStreetMap alternatives',
            isOverlay: false,
            isDefault: false,
            source: raster(
                subdomains('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'),
                '<a href="https://opentopomap.org/">OpenTopoMap</a>',
                { maxzoom: 17 },
            ),
        },
        {
            code: 'Ocm',
            title: 'OpenCycleMap',
            group: 'OpenStreetMap alternatives',
            isOverlay: false,
            isDefault: false,
            source: raster(
                subdomains('https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}{ratio}.png'),
                '<a href="https://www.opencyclemap.org/">Thunderforest OpenCycleMap</a>',
            ),
        },
        {
            code: 'Oso',
            title: 'OSM Outdoors',
            group: 'OpenStreetMap alternatives',
            isOverlay: false,
            isDefault: false,
            source: raster(
                subdomains('https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}{ratio}.png'),
                '<a href="https://www.thunderforest.com/maps/outdoors/">Thunderforest Outdoors</a>',
            ),
        },
        {
            code: 'Mt',
            title: 'Mountains by Aleksey Tsvetkov',
            group: 'Default layers',
            isOverlay: true,
            isDefault: true,
            minZoom: 1,
            // хост не отдаёт CORS — только через прокси, как в старом клиенте
            source: raster(
                [viaCorsProxy(env.corsProxyUrl, 'https://maptiles.website.yandexcloud.net/{z}/{x}/{y}.png')],
                '<a href="http://pereval.g-utka.ru/">Aleksey Tsvetkov</a>',
                { maxzoom: 15, bounds: [71.00007, 40.66664, 81.00001, 45.33338] },
            ),
        },
        {
            code: 'Ot',
            title: 'OpenStreetMap GPS traces',
            group: 'Routes and traces',
            isOverlay: true,
            isDefault: false,
            source: raster(
                subdomains('https://{s}.gps-tile.openstreetmap.org/lines/{z}/{x}/{y}.png'),
                '<a href="https://www.openstreetmap.org/#&layers=G">OpenStreetMap public GPS traces</a>',
            ),
        },
        stravaLayer('Sa', 'all', 'Strava heatmap (all)', env),
        stravaLayer('Sr', 'run', 'Strava heatmap (run)', env),
        stravaLayer('Sb', 'ride', 'Strava heatmap (ride)', env),
        stravaLayer('Sw', 'winter', 'Strava heatmap (winter)', env),
        {
            code: 'Np',
            title: 'Norway paper map',
            group: 'Norway',
            isOverlay: true,
            isDefault: false,
            source: raster(
                ['https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png'],
                KARTVERKET_ATTRIBUTION,
                { bounds: NORWAY_BOUNDS },
            ),
        },
        {
            code: 'Nm',
            title: 'Norway topo',
            group: 'Norway',
            isOverlay: true,
            isDefault: false,
            source: raster(
                ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'],
                KARTVERKET_ATTRIBUTION,
                { bounds: NORWAY_BOUNDS },
            ),
        },
        {
            code: 'Nr',
            title: 'Norway roads',
            group: 'Norway',
            isOverlay: true,
            isDefault: false,
            // отсутствующие тайлы отдаёт 500, а не 404 — у границы покрытия возможен тост ошибки слоя
            source: raster(
                ['https://maptiles1.finncdn.no/tileService/1.0.3/normap/{z}/{x}/{y}.png'],
                '<a href="https://kart.finn.no/">finn.no</a>',
                { bounds: NORWAY_BOUNDS },
            ),
        },
        {
            code: 'Fmk',
            title: 'Finland Topo',
            group: 'Topo maps',
            isOverlay: true,
            isDefault: false,
            // у старого слоя опечатка `bound`, прямоугольник не применялся; здесь применяется
            source: raster(
                [
                    'https://proxy.laji.fi/mml_wmts/maasto/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/' +
                        '{z}/{y}/{x}.png',
                ],
                '<a href="https://laji.fi/en/map/">LAJI.FI</a>',
                { bounds: [19.08321, 59.45416, 31.58671, 70.09211] },
            ),
        },
        {
            code: 'Gbt',
            title: 'Great Britain Topo',
            group: 'Topo maps',
            isOverlay: true,
            isDefault: false,
            minZoom: 11,
            // адрес из bing.com/maps/style?styleid=ordnancesurvey без key=: тайл с CORS и тем же содержимым отдаётся
            // и без ключа сессии (проверено 2026-10-08), поэтому страница bing.com/maps через прокси не нужна
            source: raster(
                [
                    'https://t.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/{quadkey}' +
                        '?mkt=&ur=ge&it=G,OS,BF,RL&og=2866&sv=9.48&n=t&o=webp,95&cstl=s23',
                ],
                '<a href="https://docs.microsoft.com/en-us/bingmaps/v8-web-control/map-control-api/' +
                    'maptypeid-enumeration">Ordnance Survey</a>',
                { maxzoom: 16, bounds: [-7.75643, 49.83793, 1.82356, 60.87164] },
            ),
        },
        {
            code: 'Wc',
            title: 'Waymarked Cycling Trails',
            group: 'Routes and traces',
            isOverlay: true,
            isDefault: false,
            source: raster(
                ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
                '<a href="https://cycling.waymarkedtrails.org/">Waymarked Cycling Trails</a>',
            ),
        },
        {
            code: 'Wh',
            title: 'Waymarked Hiking Trails',
            group: 'Routes and traces',
            isOverlay: true,
            isDefault: false,
            source: raster(
                ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
                '<a href="https://hiking.waymarkedtrails.org/">Waymarked Hiking Trails</a>',
            ),
        },
        {
            code: 'St',
            title: 'Slovakia topo',
            group: 'Topo maps',
            isOverlay: true,
            isDefault: false,
            minZoom: 9,
            // static.mapy.hiking.sk/topo/… отвечает 307 сюда без CORS-заголовка — сразу конечный адрес
            source: raster(
                ['https://tile.mapy.hiking.sk/otm/{z}/{x}/{y}.png'],
                '<a href="https://mapy.hiking.sk/">mapy.hiking.sk</a>',
                { maxzoom: 15, bounds: [16.74316, 47.5172, 22.74837, 49.91343] },
            ),
        },
        {
            code: 'Sp',
            title: 'Spain topo',
            group: 'Topo maps',
            isOverlay: true,
            isDefault: false,
            source: raster(
                [
                    'https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&' +
                        'tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&' +
                        'Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}',
                ],
                '<a href="https://www.ign.es/iberpix2/visor/">IGN (Spain) topographic map</a>',
                { bounds: [-9.51828, 35.9024, 4.50439, 43.8375] },
            ),
        },
        {
            code: 'Si',
            title: 'Switzerland topo',
            group: 'Topo maps',
            isOverlay: true,
            isDefault: false,
            // старый слой: тайл 256 px в 128 CSS px со сдвигом зума на 1 (tileSize 128, zoomOffset 1). В MapLibre
            // зум тайлов = зум карты + log2(512 / tileSize), так что tileSize 128 даёт тот же сдвиг. Напрямую, без
            // прокси: хост отдаёт CORS (проверено 2026-10-08), прокси тратил бы свой лимит.
            source: raster(
                [
                    'https://wmts10.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
                ],
                '<a href="https://map.geo.admin.ch/?topic=swisstopo&lang=en&bgLayer=' +
                    'ch.swisstopo.pixelkarte-farbe&E=2586000.76&N=1202020.96&zoom=1">Swisstopo</a>',
                { tileSize: 128, maxzoom: 17, bounds: [5.87352, 45.80269, 10.6847, 47.86445] },
            ),
        },
        {
            code: 'Se',
            title: 'Sweden topo',
            group: 'Topo maps',
            isOverlay: true,
            isDefault: false,
            source: raster(
                [
                    'https://minkarta.lantmateriet.se/map/topowebbcache' +
                        '?layer=topowebb&style=default&tilematrixset=3857&Service=WMTS&Request=GetTile&Version=1.0.0' +
                        '&Format=image%2Fpng&TileMatrix={z}&TileCol={x}&TileRow={y}',
                ],
                '<a href="https://minkarta.lantmateriet.se/">Lantmäteriet</a>',
                { maxzoom: 17, bounds: [10.58876, 55.13493, 24.18365, 69.072] },
            ),
        },
        {
            code: 'Hs',
            title: 'Relief shading',
            group: 'Miscellaneous',
            isOverlay: true,
            isDefault: true,
            // AWS Terrain Tiles (Terrarium): реплика elevation-tiles-prod-eu публично отвечает 403, тайлы есть до z15
            source: {
                type: 'raster-dem',
                encoding: 'terrarium',
                tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 15,
                attribution: TERRAIN_ATTRIBUTION,
            },
        },
    ];
}

export function buildCatalog(env: CatalogEnv): LayerDef[] {
    return definitions(env).map((def) => {
        const order = ORDER.indexOf(def.code) + 1;
        if (!order) {
            throw new Error(`Layer ${def.code} has no place in ORDER`);
        }
        return { ...def, order };
    });
}
