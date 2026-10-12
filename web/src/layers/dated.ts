import { DATE_TOKEN, type LayerDef, type LayerSource, YEAR_TOKEN } from './catalog';

// Снимки по датам (design add-dated-imagery): дата в адресе, даты съёмки над точкой из STAC Earth Search и дата по
// умолчанию. Модуль без React и стора: сеть — переданный fetch, «сегодня» — переданная дата (тесты).

// d=ГГГГ-ММ-ДД — ни старый клиент, ни апстрим ключ d не заняли (enableHashState в src/ старого клиента)
export const DATE_PARAM = 'd';

// STAC API Element 84 (https://earth-search.aws.element84.com/v1): CORS *, без ключа; заявляет fields и sort item-search
export const EARTH_SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search';
// За 90 дней у Казбеги — 65 сцен обеих коллекций, у Тромсё — 195, на Шпицбергене — 266 (перекрытие орбит у полюса):
// одна страница до 500; при большем числе теряются только старые даты, сортировка — по убыванию даты
const SEARCH_LIMIT = 500;
export const DATES_DAYS = 90;
// HLS выходит через 2–3 дня после съёмки (https://www.earthdata.nasa.gov/data/projects/hls): более свежая дата Earth
// Search может ещё не дойти до GIBS, и тайлы будут прозрачными
export const HLS_LATENCY_DAYS = 3;
// облачность сцены (eo:cloud_cover, на квадрат 110 км или сцену Landsat 185 км), при которой дата считается ясной
export const CLEAR_CLOUD_COVER = 20;
// первая дата L30 в WMTSCapabilities GIBS: раньше снимков HLS нет
export const FIRST_DATE = '2013-03-22';

export type Satellite = 'Sentinel-2' | 'Landsat';

export interface ImageryDate {
    date: string;
    // наименьшая облачность сцен дня, проценты; null — сервис не дал
    cloudCover: number | null;
    satellites: Satellite[];
}

export interface Point {
    lat: number;
    lng: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

// только настоящая дата: 2026-02-30 Date.UTC перенёс бы на март
export function isDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
        return false;
    }
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && isoDay(new Date(time)) === value;
}

// раньше первых снимков HLS — серая карта без объяснений, такая дата отбрасывается
export function parseDateParam(values: readonly string[] | undefined): string | null {
    return values?.length === 1 && isDate(values[0]) && values[0] >= FIRST_DATE ? values[0] : null;
}

// сколько полных дней прошло от даты снимка до сегодня (UTC)
export function ageDays(date: string, today: Date): number {
    return Math.round((Date.parse(`${isoDay(today)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);
}

// Слой с dated за дату: DATE_TOKEN в шаблонах, YEAR_TOKEN в подписи (год Copernicus — год снимка)
export function withDate(layer: LayerDef, date: string): LayerDef {
    const { source } = layer;
    return {
        ...layer,
        source: {
            ...source,
            tiles: source.tiles?.map((tile) => tile.replaceAll(DATE_TOKEN, date)),
            attribution: source.attribution?.replaceAll(YEAR_TOKEN, date.slice(0, 4)),
        } as LayerSource,
    };
}

// Сцены обеих коллекций, чьи контуры содержат точку, за DATES_DAYS дней. Точка, а не bbox экрана: облачность — свойство
// сцены, а bbox мелкого зума задевает десяток квадратов MGRS с разными датами
export function datesUrl(center: Point, today: Date): string {
    const from = isoDay(new Date(today.getTime() - DATES_DAYS * DAY_MS));
    const params = new URLSearchParams({
        collections: 'sentinel-2-l2a,landsat-c2-l2',
        intersects: JSON.stringify({ type: 'Point', coordinates: [center.lng, center.lat] }),
        datetime: `${from}T00:00:00Z/..`,
        limit: String(SEARCH_LIMIT),
        sortby: '-properties.datetime',
        fields: 'properties.datetime,properties.eo:cloud_cover,properties.platform,-assets,-links,-geometry,-bbox',
    });
    return `${EARTH_SEARCH_URL}?${params}`;
}

interface SceneProperties {
    datetime?: unknown;
    platform?: unknown;
    'eo:cloud_cover'?: unknown;
}

// L30 строится только из Landsat 8 и 9, а в landsat-c2-l2 — весь архив Landsat
function satelliteOf(platform: unknown): Satellite | null {
    if (typeof platform !== 'string') {
        return null;
    }
    if (/^sentinel-2[a-z]$/u.test(platform)) {
        return 'Sentinel-2';
    }
    return platform === 'landsat-8' || platform === 'landsat-9' ? 'Landsat' : null;
}

// Ответ /search → даты от свежей к старой: сцены одного дня UTC (S2A и S2B в один день, Sentinel-2 и Landsat) —
// одна дата с наименьшей облачностью
export function parseDates(body: unknown): ImageryDate[] {
    const features = (body as { features?: { properties?: SceneProperties }[] } | null)?.features;
    if (!Array.isArray(features)) {
        throw new Error('Earth Search: no features');
    }
    const byDate = new Map<string, ImageryDate>();
    for (const { properties = {} } of features) {
        const satellite = satelliteOf(properties.platform);
        const date = typeof properties.datetime === 'string' ? properties.datetime.slice(0, 10) : '';
        if (!satellite || !isDate(date)) {
            continue;
        }
        const cloud = properties['eo:cloud_cover'];
        const cloudCover = typeof cloud === 'number' ? cloud : null;
        const day = byDate.get(date) ?? { date, cloudCover: null, satellites: [] };
        if (cloudCover !== null && (day.cloudCover === null || cloudCover < day.cloudCover)) {
            day.cloudCover = cloudCover;
        }
        if (!day.satellites.includes(satellite)) {
            day.satellites.push(satellite);
            day.satellites.sort();
        }
        byDate.set(date, day);
    }
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// Самая свежая ясная дата не моложе HLS_LATENCY_DAYS, иначе наименее облачная из них, иначе самая свежая (все
// моложе). dates — от свежей к старой
export function defaultDate(dates: readonly ImageryDate[], today: Date): string | null {
    const ready = dates.filter((item) => ageDays(item.date, today) >= HLS_LATENCY_DAYS);
    const clear = ready.find((item) => item.cloudCover !== null && item.cloudCover <= CLEAR_CLOUD_COVER);
    if (clear) {
        return clear.date;
    }
    const cloudiness = (item: ImageryDate) => item.cloudCover ?? Number.POSITIVE_INFINITY;
    const leastCloudy = ready.reduce<ImageryDate | null>(
        (best, item) => (best && cloudiness(best) <= cloudiness(item) ? best : item),
        null,
    );
    return leastCloudy?.date ?? dates[0]?.date ?? null;
}

export async function fetchDates(
    fetchImpl: typeof fetch,
    center: Point,
    today: Date,
    signal?: AbortSignal,
): Promise<ImageryDate[]> {
    const response = await fetchImpl(datesUrl(center, today), { signal });
    if (!response.ok) {
        throw new Error(`Earth Search: HTTP ${response.status}`);
    }
    return parseDates(await response.json());
}
