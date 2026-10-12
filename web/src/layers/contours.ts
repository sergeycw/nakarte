import type { AddProtocolAction, RequestTransformFunction, ResourceType } from 'maplibre-gl';
import { TERRARIUM_MAX_ZOOM, TERRARIUM_TILES } from './catalog';

// Тайлы горизонталей (оверлей Ct, design add-contour-lines): обработчик протокола CONTOUR_PROTOCOL каталога. Тайлы
// рельефа Terrarium грузит и линии строит maplibre-contour (BSD-3); библиотека импортируется при первом тайле, так что
// без включённых горизонталей её чанка и воркера нет.

type ContourLib = typeof import('maplibre-contour')['default'];
type DemSource = InstanceType<ContourLib['DemSource']>;

// Шаг по зуму MapLibre (m= адреса на 1 больше): [промежуточная, основная], м. Зум без записи берёт ближайший меньший
// (GlobalContourTileOptions.thresholds), ниже первого — линий нет. Расчёт — design add-contour-lines, «Шаг по зуму»
export const CONTOUR_THRESHOLDS: Record<number, [number, number]> = {
    10: [200, 1000],
    11: [100, 500],
    12: [50, 250],
    13: [20, 100],
    14: [10, 50],
};

// слой и свойства векторного тайла (по умолчанию у библиотеки те же); стиль линий и подписей — src/layers/style.ts
export const CONTOUR_LAYER = 'contours';
// высота, м
export const CONTOUR_ELEVATION = 'ele';
// 0 — промежуточная, 1 — основная: наибольший номер в паре thresholds, которому кратна высота
export const CONTOUR_LEVEL = 'level';

// значения из примера README maplibre-contour
const CACHE_SIZE = 100;
const TIMEOUT_MS = 10_000;

// transformRequest — только для browser-тестов: тогда библиотека работает на главном потоке и берёт тайлы рельефа через
// него, как карта берёт остальные тайлы (src/test/tiles.ts). Без него — свой Web Worker библиотеки (Blob URL), и его
// fetch идёт мимо transformRequest карты.
export function contourProtocol(transformRequest?: RequestTransformFunction): AddProtocolAction {
    let source: Promise<{ dem: DemSource; query: string }> | undefined;
    return async (request, abortController) => {
        // неудачный импорт чанка не запоминается: следующий тайл пробует снова
        source ??= createSource(transformRequest).catch((error: unknown) => {
            source = undefined;
            throw error;
        });
        const { dem, query } = await source;
        // обработчик библиотеки берёт z/x/y из //z/x/y, а шаг и прочие опции — из строки запроса: её собирает сама
        // библиотека (contourProtocolUrl), свой формат опций не повторяем
        return dem.contourProtocolV4({ ...request, url: `${request.url}?${query}` }, abortController);
    };
}

async function createSource(transformRequest: RequestTransformFunction | undefined) {
    const { default: mlcontour } = await import('maplibre-contour');
    const params = {
        encoding: 'terrarium',
        maxzoom: TERRARIUM_MAX_ZOOM,
        cacheSize: CACHE_SIZE,
        timeoutMs: TIMEOUT_MS,
    } as const;
    const dem = new mlcontour.DemSource({ ...params, url: TERRARIUM_TILES, worker: !transformRequest });
    if (transformRequest) {
        // DemSource свой getTile не принимает, а LocalDemManager — да; manager у DemSource — открытое поле
        dem.manager = new mlcontour.LocalDemManager({
            ...params,
            demUrlPattern: TERRARIUM_TILES,
            getTile: async (url, abortController) => {
                const transformed = (await transformRequest(url, 'Tile' as ResourceType)) ?? { url };
                const response = await fetch(transformed.url, { signal: abortController.signal });
                if (!response.ok) {
                    throw new Error(`Bad response: ${response.status} for ${url}`);
                }
                return { data: await response.blob() };
            },
        });
    }
    const query = dem
        .contourProtocolUrl({
            thresholds: CONTOUR_THRESHOLDS,
            contourLayer: CONTOUR_LAYER,
            elevationKey: CONTOUR_ELEVATION,
            levelKey: CONTOUR_LEVEL,
        })
        .split('?')[1];
    return { dem, query };
}
