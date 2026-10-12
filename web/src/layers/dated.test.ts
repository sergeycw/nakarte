import { describe, expect, test } from 'vitest';
import { buildCatalog, type LayerDef } from './catalog';
import {
    datesUrl,
    defaultDate,
    fetchDates,
    type ImageryDate,
    isDate,
    parseDateParam,
    parseDates,
    withDate,
} from './dated';
import earthSearch from './fixtures/earth-search.json';

const TODAY = new Date('2026-10-12T09:00:00Z');
const KAZBEGI = { lat: 42.7, lng: 44.6 };

function scene(datetime: string, platform: string, cloud: number) {
    return { properties: { datetime, platform, 'eo:cloud_cover': cloud } };
}

describe('Снимки по датам: даты съёмки', () => {
    test('ответ Earth Search у Казбеги: дни от свежего к старому, сцены дня схлопнуты, облачность — наименьшая', () => {
        const dates = parseDates(earthSearch);
        expect(dates.slice(0, 5)).toEqual([
            { date: '2026-10-10', cloudCover: 8.272856, satellites: ['Sentinel-2'] },
            { date: '2026-10-08', cloudCover: 7.65, satellites: ['Landsat'] },
            { date: '2026-10-07', cloudCover: 96.336126, satellites: ['Sentinel-2'] },
            { date: '2026-10-05', cloudCover: 1.593734, satellites: ['Sentinel-2'] },
            { date: '2026-10-04', cloudCover: 31.541041, satellites: ['Sentinel-2'] },
        ]);
        expect(dates.find((item) => item.date === '2026-09-30')).toEqual({
            date: '2026-09-30',
            cloudCover: 88.025373,
            satellites: ['Landsat', 'Sentinel-2'],
        });
        expect(new Set(dates.map((item) => item.date)).size).toBe(dates.length);
    });

    test('Landsat не 8 и не 9 и сцены без даты отбрасываются', () => {
        const dates = parseDates({
            features: [
                scene('2026-10-01T07:00:00Z', 'landsat-7', 1),
                scene('2026-10-02T07:00:00Z', 'landsat-9', 5),
                { properties: { platform: 'sentinel-2a' } },
            ],
        });
        expect(dates).toEqual([{ date: '2026-10-02', cloudCover: 5, satellites: ['Landsat'] }]);
    });

    test('ответ без features — ошибка', () => {
        expect(() => parseDates({ code: 'BadRequest' })).toThrow();
    });

    test('запрос: обе коллекции, точка центра, 90 дней, по убыванию даты', () => {
        const url = new URL(datesUrl(KAZBEGI, TODAY));
        expect(url.origin + url.pathname).toBe('https://earth-search.aws.element84.com/v1/search');
        expect(url.searchParams.get('collections')).toBe('sentinel-2-l2a,landsat-c2-l2');
        expect(JSON.parse(url.searchParams.get('intersects') ?? '')).toEqual({
            type: 'Point',
            coordinates: [44.6, 42.7],
        });
        expect(url.searchParams.get('datetime')).toBe('2026-07-14T00:00:00Z/..');
        expect(url.searchParams.get('sortby')).toBe('-properties.datetime');
    });

    test('ошибка сервиса — исключение', async () => {
        const failing: typeof fetch = async () => new Response('', { status: 502 });
        await expect(fetchDates(failing, KAZBEGI, TODAY)).rejects.toThrow('HTTP 502');
    });
});

describe('Дата снимка по умолчанию', () => {
    const day = (date: string, cloudCover: number | null): ImageryDate => ({
        date,
        cloudCover,
        satellites: ['Sentinel-2'],
    });

    test('Дата по умолчанию', () => {
        const dates = [day('2026-10-10', 8), day('2026-10-07', 97), day('2026-10-05', 2)];
        expect(defaultDate(dates, TODAY)).toBe('2026-10-05');
    });

    test('у Казбеги 2026-10-12 — ясный Landsat 2026-10-08', () => {
        expect(defaultDate(parseDates(earthSearch), TODAY)).toBe('2026-10-08');
    });

    test('ясной нет — наименее облачная из готовых, все свежие — самая свежая, пусто — null', () => {
        expect(defaultDate([day('2026-10-09', 40), day('2026-10-05', 30), day('2026-10-01', 90)], TODAY)).toBe(
            '2026-10-05',
        );
        expect(defaultDate([day('2026-10-11', 90), day('2026-10-10', 1)], TODAY)).toBe('2026-10-11');
        expect(defaultDate([], TODAY)).toBeNull();
    });
});

describe('Снимки по датам: дата в адресе и слой', () => {
    test('d= — только настоящая дата ГГГГ-ММ-ДД', () => {
        expect(parseDateParam(['2026-10-05'])).toBe('2026-10-05');
        for (const values of [['2026-02-30'], ['2026-1-5'], ['2013-03-21'], ['2026-10-05', 'x'], [], undefined]) {
            expect(parseDateParam(values)).toBeNull();
        }
        expect(isDate('2024-02-29')).toBe(true);
        expect(parseDateParam(['2013-03-22'])).toBe('2013-03-22');
    });

    test('Снимок за дату из ссылки: дата в адресах тайлов, год в подписи', () => {
        const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });
        const hls = catalog.find((layer) => layer.code === 'Hls') as LayerDef;
        const dated = withDate(hls, '2026-10-05');
        expect(dated.source.tiles).toEqual([
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_L30_Nadir_BRDF_Adjusted_Reflectance/default/2026-10-05/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
            'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/2026-10-05/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
        ]);
        expect(dated.source.attribution).toContain('Copernicus Sentinel data 2026,');
        expect(hls.source.tiles?.[0]).toContain('{date}');
    });
});
