import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { P } from '@/test/map-events';
import { renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import { POSITION_KEY } from './locate';

// Кнопки карты в App (спека web-client: «Где я», «Последнее положение при заходе»,
// «Масштаб и зум на карте»). Геолокация браузера подменяется на время теста: настоящая в headless спросила бы разрешение.

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
});

afterEach(async () => {
    await cleanup();
    // своё свойство убирается — возвращается настоящий navigator.geolocation прототипа
    Reflect.deleteProperty(navigator, 'geolocation');
    vi.restoreAllMocks();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

interface FakeAnswer {
    position?: { lat: number; lng: number; accuracy: number };
    error?: { code: number; message: string };
}

// Подменённая геолокация: на watchPosition и getCurrentPosition отвечает сразу заданным положением или ошибкой
function fakeGeolocation(answer: FakeAnswer) {
    const calls = { watch: 0, current: 0 };
    const respond = (success: PositionCallback, failure?: PositionErrorCallback | null) => {
        setTimeout(() => {
            if (answer.position) {
                const { lat, lng, accuracy } = answer.position;
                success({
                    coords: { latitude: lat, longitude: lng, accuracy } as GeolocationCoordinates,
                    timestamp: Date.now(),
                } as GeolocationPosition);
            } else if (answer.error) {
                failure?.({
                    ...answer.error,
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3,
                } as GeolocationPositionError);
            }
        }, 10);
    };
    const geolocation = {
        watchPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
            calls.watch += 1;
            respond(success, failure);
            return 1;
        },
        getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => {
            calls.current += 1;
            respond(success, failure);
        },
        clearWatch: () => {},
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
    return calls;
}

const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.abs(a.lat - b.lat) < 1e-3 && Math.abs(a.lng - b.lng) < 1e-3;

describe('Где я', () => {
    test('Положение получено', async () => {
        fakeGeolocation({ position: { lat: 41.7, lng: 44.8, accuracy: 30 } });
        const { map } = await renderApp(tiles, '#m=10/41/44&l=O');
        await page.getByRole('button', { name: 'Find my location' }).click();
        // MapLibre летит к положению анимацией flyTo
        await expect.poll(() => near(map.getCenter(), P(41.7, 44.8)), { timeout: 5000 }).toBe(true);
        await expect.poll(() => document.querySelector('.maplibregl-user-location-dot')).not.toBeNull();
        expect(document.querySelector('.maplibregl-user-location-accuracy-circle')).not.toBeNull();
        // положение запомнено для следующего захода
        expect(JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null')).toEqual({ lat: 41.7, lng: 44.8 });
    });

    test('Геолокация запрещена', async () => {
        fakeGeolocation({ error: { code: 1, message: 'User denied Geolocation' } });
        localStorage.setItem(POSITION_KEY, '{"lat":41.7,"lng":44.8}');
        await renderApp(tiles, '#m=10/41/44&l=O');
        await page.getByRole('button', { name: 'Find my location' }).click();
        await expect
            .element(page.getByText('Geolocation is blocked for this site. Please, enable in browser setting.'))
            .toBeVisible();
        expect(localStorage.getItem(POSITION_KEY)).toBe('null');
    });

    test('прочая ошибка — текст браузера', async () => {
        fakeGeolocation({ error: { code: 3, message: 'Timeout expired' } });
        await renderApp(tiles, '#m=10/41/44&l=O');
        await page.getByRole('button', { name: 'Find my location' }).click();
        await expect.element(page.getByText('Geolocation error: Timeout expired')).toBeVisible();
    });
});

describe('Последнее положение при заходе', () => {
    test('Заход с запомненным положением', async () => {
        // браузер отвечает другим положением чуть позже — карта переходит к нему
        const calls = fakeGeolocation({ position: { lat: 41.8, lng: 44.9, accuracy: 30 } });
        localStorage.setItem(POSITION_KEY, '{"lat":41.69,"lng":44.78}');
        const { map } = await renderApp(tiles, '');
        expect(calls.current).toBe(1);
        await expect.poll(() => near(map.getCenter(), P(41.8, 44.9))).toBe(true);
        expect(map.getZoom()).toBe(7);
    });

    test('без ответа браузера — запомненное положение', async () => {
        fakeGeolocation({});
        localStorage.setItem(POSITION_KEY, '{"lat":41.69,"lng":44.78}');
        const { map } = await renderApp(tiles, '');
        expect(near(map.getCenter(), P(41.69, 44.78))).toBe(true);
    });

    test('Заход по ссылке с видом', async () => {
        const calls = fakeGeolocation({ position: { lat: 41.8, lng: 44.9, accuracy: 30 } });
        localStorage.setItem(POSITION_KEY, '{"lat":41.69,"lng":44.78}');
        const { map } = await renderApp(tiles, '#m=13/42.68490/47.07008&l=O');
        expect(near(map.getCenter(), P(42.6849, 47.07008))).toBe(true);
        expect(calls.current).toBe(0);
    });

    test('без запомненного положения браузер не спрашивается', async () => {
        const calls = fakeGeolocation({ position: { lat: 41.8, lng: 44.9, accuracy: 30 } });
        await renderApp(tiles, '');
        expect(calls.current).toBe(0);
    });
});

describe('Масштаб и зум на карте', () => {
    test('Номер зума', async () => {
        const { map } = await renderApp(tiles, '#m=13/42.68490/47.07008&l=O');
        await expect.element(page.getByTestId('zoom-level')).toHaveTextContent('13');
        expect(document.querySelector('.maplibregl-ctrl-scale')?.textContent).toMatch(/\d+\s?(m|km)/u);
        map.jumpTo({ zoom: 15 });
        await expect.element(page.getByTestId('zoom-level')).toHaveTextContent('16');
    });
});
