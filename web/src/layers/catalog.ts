import type { RasterDEMSourceSpecification, RasterSourceSpecification, VectorSourceSpecification } from 'maplibre-gl';

// Каталог растровых слоёв нового приложения — данные старого src/layers.js, переведённые в источники MapLibre
// (design add-web-map-layers, «Каталог»). Без Яндекса (Y, S: EPSG:3395), Wikimapia (W) и сетки Ng — решения
// владельца (record-new-ui-decisions). Модуль без импортов приложения: его же импортирует e2e (Node), чтобы
// знать, какие тайлы подменять фикстурой.
//
// Перевод опций Leaflet: зум карты MapLibre на 1 меньше Leaflet, нумерация тайлов та же. Поэтому maxNativeZoom
// переходит в maxzoom источника как есть (без него — 18: старая карта выше maxZoom 18 не поднималась), а minZoom
// слоя — в minZoom - 1. cutline отброшен, остаётся прямоугольник bounds.

export type LayerSource = RasterSourceSpecification | RasterDEMSourceSpecification | VectorSourceSpecification;

// AWS Terrain Tiles (Terrarium): реплика elevation-tiles-prod-eu публично отвечает 403, тайлы есть до z15. Один адрес у
// отмывки (MapLibre) и горизонталей (maplibre-contour грузит тайлы сам, src/layers/contours.ts)
export const TERRARIUM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRARIUM_MAX_ZOOM = 15;

// Векторные тайлы горизонталей отдаёт свой протокол MapLibre (src/layers/contours.ts, регистрация — src/map/maplibre.ts):
// здесь только адрес, чтобы каталог оставался данными без импорта библиотеки (design add-contour-lines)
export const CONTOUR_PROTOCOL = 'nakarte-contours';
export const CONTOUR_MIN_ZOOM = 10;

// Снимки по датам (design add-dated-imagery): токены в шаблонах тайлов и подписи слоя с dated, подставляет withDate
// (src/layers/dated.ts). MapLibre таких токенов не знает — слой без подстановки в стиль не попадает (BaseMap)
export const DATE_TOKEN = '{date}';
export const YEAR_TOKEN = '{year}';

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
    // векторная подложка (OpenFreeMap Outdoor): язык подписей — navigator.language, стиль строит outdoorLayers
    // (src/layers/outdoor.ts) в style.ts, у которого окружения каталога нет
    labelLanguage?: string;
    // снимки по датам: в source.tiles — по шаблону с DATE_TOKEN на слой GIBS снизу вверх, style.ts рисует каждый своим
    // источником, а не чередует по тайлам, как поддомены
    dated?: boolean;
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
// Порядок подложек виден только в Configure layers: в полном списке их нет, круги и меню идут по группам quick-layers.ts
// (design custom-bases-in-list). Tt, Of, O, E первыми — с решения владельца 2026-10-12 (design
// add-vector-outdoor-style)
const ORDER = [
    'Tt',
    'Of',
    'O',
    'E',
    'S2',
    'Hls',
    'Co',
    'Otm',
    'Ocm',
    'Oso',
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
    'Ct',
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
// Подпись Topo — дословно из условий Tracestrack, раздел 5 (https://www.tracestrack.com/terms-of-service/, сверено
// 2026-10-10, design map-chrome): тайлы под CC BY 4.0, атрибуция обязательна
const TRACESTRACK_ATTRIBUTION = `Data: ${OSM_ATTRIBUTION}, SRTM, GEBCO, SONNY's LiDAR DTM, NASADEM, ESA WorldCover; <a href="https://www.tracestrack.com/">Maps &copy; Tracestrack</a>`;
// OpenFreeMap (design add-vector-outdoor-style): TileJSON, а не шаблон тайлов — в адресе тайлов версия сборки планеты,
// она меняется, а путь без версии отдаёт пустой тайл (проверено 2026-10-12). Подпись — из TileJSON без target, в
// источнике: явные опции источника MapLibre ставит выше полей TileJSON
export const OPENFREEMAP_TILEJSON = 'https://tiles.openfreemap.org/planet';
const OPENFREEMAP_ATTRIBUTION =
    '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const STRAVA_ATTRIBUTION = '<a href="https://www.strava.com/heatmap">Strava Global Heatmap</a>';
const KARTVERKET_ATTRIBUTION = '<a href="https://kartverket.no/til-lands/kart/turkart">Kartverket</a>';
const GOOGLE_ATTRIBUTION = '<a href="https://www.google.com/maps">Google</a>';
const GOOGLE_SAT_ATTRIBUTION =
    '<a href="https://www.google.com/maps/@43.0668619,60.5738071,13622628m/data=!3m1!1e3">Google</a>';
// Год мозаики EOX Sentinel-2 cloudless (design add-sentinel-imagery): из него — и слой WMTS, и год в подписи. Новый
// год появляется в https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml слоем s2cloudless-<год>_3857 (backlog,
// «Сопровождение»); s2cloudless_3857 без года — мозаика 2016, а не последняя
const SENTINEL_YEAR = 2025;
// Подпись — дословно из условий EOX (https://cloudless.eox.at/documentation/license, сверено 2026-10-11): адрес
// виден текстом и он же ссылка (license-non-commercial: «include the links and show the text»); лицензия 2018+ —
// CC BY-NC-SA 4.0, только некоммерческое использование
const SENTINEL_ATTRIBUTION =
    'EOxCloudless <a href="https://cloudless.eox.at">https://cloudless.eox.at</a> by EOX IT Services GmbH ' +
    `(Contains modified Copernicus Sentinel data ${SENTINEL_YEAR}), ` +
    '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>';
// HLS из NASA GIBS (design add-dated-imagery, «Подпись с годом даты»), сверено 2026-10-12: благодарность GIBS — дословно из
// Data Use Guidance (https://nasa-gibs.github.io/gibs-api-docs/), Copernicus — «Contains modified Copernicus Sentinel data
// [год]» (https://ads.atmosphere.copernicus.eu/licences/ec-sentinel), USGS — форма «… courtesy of the U.S. Geological
// Survey» (https://www.usgs.gov/centers/eros/data-citation). Год — год даты снимка
const HLS_ATTRIBUTION =
    'We acknowledge the use of imagery provided by services from ' +
    '<a href="https://nasa-gibs.github.io/gibs-api-docs/">NASA\'s Global Imagery Browse Services (GIBS)</a>, ' +
    "part of NASA's Earth Science Data and Information System (ESDIS); " +
    '<a href="https://www.earthdata.nasa.gov/data/projects/hls">HLS</a>: ' +
    `contains modified Copernicus Sentinel data ${YEAR_TOKEN}, Landsat image courtesy of the U.S. Geological Survey`;
// Слои GIBS снизу вверх: Landsat 8/9 (L30) и Sentinel-2 (S30), оба 30 м. Матрица GoogleMapsCompatible_Level12 — тайлы
// 256 px до z12, z13 GIBS отвечает 400; порядок {y}/{x} — TileRow/TileCol шаблона из WMTSCapabilities
// (https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)
const HLS_LAYERS = ['HLS_L30_Nadir_BRDF_Adjusted_Reflectance', 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance'];
const HLS_MAX_ZOOM = 12;
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

// Языки подписей растра Tracestrack — имена карт из документации (https://tracestrack.com/docs/, сверено 2026-10-12),
// с префиксом topo_ — топостиль. Тот же список — в TILE_PATH прокси (workers/cors-proxy/src/tracestrack.js): ключ
// тратится только на эти адреса. Правка одного — правка обоих
export const TRACESTRACK_LANGUAGES = [
    'ar',
    'de',
    'en',
    'es',
    'fi',
    'fr',
    'hu',
    'he',
    'it',
    'ja',
    'ko',
    'nl',
    'uk',
    'pl',
    'pt',
    'ru',
    'th',
    'sv',
    'tr',
    'zh-hans',
    'zh-hant',
];

// Подписи на языке браузера, а без него — английские (решение владельца 2026-10-12, design tracestrack-labels): в Грузии
// местные названия грузинским письмом. Язык — в адресе, а не auto-en Tracestrack по Accept-Language: кеш браузера и
// прокси хранит тайл по адресу, и язык одного пользователя достался бы другому
export function tracestrackMap(language: string): string {
    const [primary, ...rest] = language.toLowerCase().split('-');
    let code = primary;
    if (primary === 'zh') {
        // китайский: традиционное письмо — Тайвань, Гонконг, Макао или явный Hant, иначе упрощённое
        code = rest.some((part) => ['hant', 'tw', 'hk', 'mo'].includes(part)) ? 'zh-hant' : 'zh-hans';
    }
    return `topo_${TRACESTRACK_LANGUAGES.includes(code) ? code : 'en'}`;
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
        // хитмэпы — только кнопка столбца с меню (design custom-bases-in-list), галочки в списке у них по умолчанию и так
        // стоят (listedByDefault). isDefault у «all» держит группу Routes and traces в секции Overlays списка
        // (overlaySections в LayerSwitcher.tsx); у старого клиента — isDefault: false у всех четырёх
        isDefault: code === 'Sa',
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
            // openstreetmap.org; язык подписей — tracestrackMap; {ratio} — @2x на экранах от 2x, тот же кредит квоты
            source: raster(
                [
                    viaCorsProxy(
                        env.corsProxyUrl,
                        `https://tile.tracestrack.com/${tracestrackMap(env.language)}/{z}/{x}/{y}{ratio}.webp`,
                    ),
                ],
                TRACESTRACK_ATTRIBUTION,
                { maxzoom: 19 },
            ),
        },
        {
            code: 'Of',
            title: 'OpenFreeMap Outdoor',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            // свой векторный стиль на тайлах OpenFreeMap (схема OpenMapTiles, до z14), без ключа: подписи — местное
            // название и под ним язык браузера или латиница на любом зуме (Tracestrack переводит только до z12)
            labelLanguage: env.language,
            source: { type: 'vector', url: OPENFREEMAP_TILEJSON, attribution: OPENFREEMAP_ATTRIBUTION },
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
            code: 'S2',
            title: 'Sentinel-2 cloudless',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            // напрямую: EOX отражает Origin в CORS, ключа нет. Матрица g — GoogleMapsCompatible, порядок {y}/{x}.
            // maxzoom 14 — пирамида EOX для EPSG:3857 (10 м на пиксель); тайлы z15+ сервер растягивает из тех же
            // данных, MapLibre сделает это сам без запросов
            source: raster(
                [`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${SENTINEL_YEAR}_3857/default/g/{z}/{y}/{x}.jpg`],
                SENTINEL_ATTRIBUTION,
                { maxzoom: 14 },
            ),
        },
        {
            code: 'Hls',
            title: 'Satellite by date',
            group: 'Default layers',
            isOverlay: false,
            isDefault: true,
            dated: true,
            // напрямую: GIBS отвечает Access-Control-Allow-Origin: *, ключа нет. Дата без съёмки над тайлом — 200 с прозрачным
            // PNG, поэтому оба спутника вместе дают снимок там, где снимал хоть один
            source: raster(
                HLS_LAYERS.map(
                    (layer) =>
                        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${DATE_TOKEN}` +
                        '/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
                ),
                HLS_ATTRIBUTION,
                { maxzoom: HLS_MAX_ZOOM },
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
            source: {
                type: 'raster-dem',
                encoding: 'terrarium',
                tiles: [TERRARIUM_TILES],
                tileSize: 256,
                maxzoom: TERRARIUM_MAX_ZOOM,
                attribution: TERRAIN_ATTRIBUTION,
            },
        },
        {
            code: 'Ct',
            title: 'Contour lines',
            group: 'Miscellaneous',
            isOverlay: true,
            isDefault: true,
            // ниже z10 горизонталей нет, и рельеф ради них не грузится (шаг по зуму — contours.ts); тайлы 512 px по
            // умолчанию: тайл горизонталей zN строится из тайла рельефа zN и восьми соседей
            minZoom: CONTOUR_MIN_ZOOM,
            source: {
                type: 'vector',
                tiles: [`${CONTOUR_PROTOCOL}://{z}/{x}/{y}`],
                minzoom: CONTOUR_MIN_ZOOM,
                maxzoom: TERRARIUM_MAX_ZOOM,
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
