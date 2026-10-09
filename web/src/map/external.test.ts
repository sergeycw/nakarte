import { describe, expect, it } from 'vitest';
import { EXTERNAL_MAPS, externalMapUrl, FALLBACK_ELEVATION, googleEarthDistance } from './external';

const byTitle = (title: string) => {
    const map = EXTERNAL_MAPS.find((item) => item.title === title);
    if (!map) {
        throw new Error(title);
    }
    return map;
};

// вид в зуме MapLibre: 13 — это 14 старого клиента
const VIEW = { lat: 41.690000001, lng: 44.78, zoom: 13 };
const noElevation = { fetch: async () => new Response('', { status: 500 }), url: 'https://elevation.test/' };
const extra = { elevation: 0, windowHeight: 800 };

describe('внешние карты', () => {
    it('меню старого клиента в том же порядке', () => {
        expect(EXTERNAL_MAPS.map((map) => map.title)).toEqual([
            'Google',
            'Yandex',
            'OpenStreetMap',
            'Google Earth 3D',
            'Mapy.com',
            'Wikimapia',
            'Meteoblue',
        ]);
    });

    it('Открыть в OpenStreetMap: зум старого клиента, координаты без шума', () => {
        expect(byTitle('OpenStreetMap').url(VIEW, extra)).toBe('https://www.openstreetmap.org/#map=14/41.69/44.78');
    });

    it('Зум за пределами сервиса', () => {
        expect(byTitle('OpenStreetMap').url({ ...VIEW, zoom: 20 }, extra)).toBe(
            'https://www.openstreetmap.org/#map=19/41.69/44.78',
        );
        expect(byTitle('Google').url({ ...VIEW, zoom: 0.2 }, extra)).toBe(
            'https://www.google.com/maps/@41.69,44.78,3z',
        );
    });

    it.each([
        ['Google', 'https://www.google.com/maps/@41.69,44.78,14z'],
        ['Yandex', 'https://yandex.ru/maps/?ll=44.78%2C41.69&z=14'],
        ['Mapy.com', 'https://mapy.com/en/turisticka?x=44.78&y=41.69&z=14'],
        ['Wikimapia', 'https://wikimapia.org/#lat=41.69&lon=44.78&z=14'],
        ['Meteoblue', 'https://www.meteoblue.com/en/weather/week/41.69N44.78E'],
    ])('%s', (title, url) => {
        expect(byTitle(title).url(VIEW, extra)).toBe(url);
    });

    it('Meteoblue — знак и буквы N, E в любом полушарии', () => {
        expect(byTitle('Meteoblue').url({ lat: -33.9, lng: -70.6, zoom: 5 }, extra)).toBe(
            'https://www.meteoblue.com/en/weather/week/-33.9N-70.6E',
        );
    });

    it('Google Earth: камера над высотой места из API высот', async () => {
        const requests: string[] = [];
        const source = {
            url: 'https://elevation.test/',
            fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
                requests.push(String(init?.body));
                return new Response('500');
            },
        };
        const url = await externalMapUrl(byTitle('Google Earth 3D'), VIEW, source, 800);
        expect(requests).toEqual(['41.690000 44.780000']);
        const distance = googleEarthDistance(VIEW, 500, 800);
        expect(url).toBe(`https://earth.google.com/web/@41.69,44.78,0a,${distance}d,35y,0h,0t,0r`);
        // формула старого: 400 px / tan(17.5°) × метров на пиксель z14 на широте 41.69°
        expect(distance).toBeCloseTo(
            (400 / Math.tan((17.5 * Math.PI) / 180)) * (40075016 / 256 / 2 ** 14) * Math.cos((41.69 * Math.PI) / 180) +
                500,
            6,
        );
    });

    it('Google Earth без ответа API высот — 8000 м', async () => {
        const url = await externalMapUrl(byTitle('Google Earth 3D'), VIEW, noElevation, 800);
        expect(url).toContain(`,0a,${googleEarthDistance(VIEW, FALLBACK_ELEVATION, 800)}d,`);
    });

    it('прочим картам высота не нужна — запроса нет', async () => {
        let called = false;
        const source = {
            url: 'https://elevation.test/',
            fetch: async () => {
                called = true;
                return new Response('1');
            },
        };
        await externalMapUrl(byTitle('Google'), VIEW, source, 800);
        expect(called).toBe(false);
    });
});
