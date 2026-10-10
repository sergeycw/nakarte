import type { MapRef } from '@vis.gl/react-maplibre';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { App } from './App';
// стили приложения нужны тесту целиком: проверяется, как Tailwind и CSS MapLibre уживаются на одной странице
import './index.css';
import { type FixtureTiles, fixtureTiles } from './test/tiles';

// Настоящая карта MapLibre в Chromium; тайлы всех слоёв — локальная фикстура (src/test/tiles.ts), в сеть тест
// не ходит. Названия тестов — сценарии спек web-client и map-layers.

// ответы с заданным статусом отдаёт плагин statusResponses в vitest.config.ts
const UNAVAILABLE_URL = new URL('/__status__/503/tile.png', location.href).href;
const MISSING_URL = new URL('/__status__/404/tile.png', location.href).href;

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', location.pathname + location.search);
    tiles = fixtureTiles();
});

afterEach(() => {
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

async function renderApp(hash = '') {
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    const mapRef = createRef<MapRef>();
    const screen = await render(<App transformRequest={tiles.transformRequest} mapRef={mapRef} />);
    await expect.poll(() => mapRef.current?.getMap().loaded(), { timeout: 10_000 }).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: карта загружена строкой выше
    return { screen, map: mapRef.current!.getMap() };
}

function centerOf(element: Element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('Интерфейс поверх карты', () => {
    test('Контролы карты', async () => {
        await renderApp();
        const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement;
        const container = document.querySelector('[data-testid="map"]') as HTMLElement;
        expect(canvas.getBoundingClientRect().width).toBeCloseTo(container.getBoundingClientRect().width, 0);
        expect(canvas.getBoundingClientRect().height).toBeCloseTo(container.getBoundingClientRect().height, 0);

        const zoomIn = document.querySelector('.maplibregl-ctrl-zoom-in') as HTMLElement;
        const { x, y } = centerOf(zoomIn);
        expect(zoomIn.contains(document.elementFromPoint(x, y))).toBe(true);
        await expect.element(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
    });

    test('Клик по панели', async () => {
        const { map } = await renderApp();
        // плавающая панель — капсула строки поиска слева сверху
        const panel = page.getByTestId('search-bar');
        await expect.element(panel).toBeVisible();

        const panelElement = panel.element() as HTMLElement;
        const rect = panelElement.getBoundingClientRect();
        for (const [x, y] of [
            // отступ больше радиуса скругления: хит-тест углов учитывает border-radius
            [rect.left + 16, rect.top + 16],
            [rect.right - 16, rect.bottom - 16],
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
        ]) {
            expect(panelElement.contains(document.elementFromPoint(x, y))).toBe(true);
        }

        const before = map.getCenter();
        // у поля поиска, мимо кнопок: углы строки скруглены, и клик в самом углу ушёл бы карте
        await userEvent.click(panelElement, { position: { x: 16, y: 16 } });
        await userEvent.dblClick(panelElement, { position: { x: 16, y: 16 } });
        expect(map.getCenter()).toEqual(before);
        expect(map.getZoom()).toBe(7);
    });
});

describe('Тост при ошибке тайлов', () => {
    test('Сервер тайлов недоступен', async () => {
        tiles.respond(/tile\.openstreetmap\.org/, UNAVAILABLE_URL);
        const { map } = await renderApp('#l=O');
        await expect.element(page.getByText('Map tiles failed to load')).toBeVisible();
        await expect.element(page.getByText('OpenStreetMap', { exact: true })).toBeVisible();

        // новые тайлы — новые ошибки, но тост остаётся один
        map.jumpTo({ zoom: 10 });
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(page.getByText('Map tiles failed to load').all()).toHaveLength(1);
        expect(map.getZoom()).toBe(10);
    });

    test('Тайла нет в покрытии', async () => {
        tiles.respond(/waymarkedtrails/, MISSING_URL);
        const { map } = await renderApp('#l=O/Wh');
        await expect.poll(() => tiles.requested.some((url) => url.includes('waymarkedtrails'))).toBe(true);
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(page.getByText('Map tiles failed to load').all()).toHaveLength(0);
        expect(map.getLayer('Wh')).toBeDefined();
    });
});

describe('Подложка Tracestrack', () => {
    const TRACESTRACK = /\/https\/tile\.tracestrack\.com\/topo__\//;

    test('Атрибуция Tracestrack', async () => {
        await renderApp();
        await expect.poll(() => tiles.requested.some((url) => TRACESTRACK.test(url))).toBe(true);
        expect(tiles.requested.some((url) => url.includes('tile.openstreetmap.org'))).toBe(false);
        expect(tiles.requested.some((url) => url.includes('key='))).toBe(false);
        await expect.element(page.getByRole('link', { name: 'Maps © Tracestrack' })).toBeVisible();
        expect(location.hash).toContain('l=Tt');
    });

    test('Нет ключа или квоты', async () => {
        tiles.respond(TRACESTRACK, UNAVAILABLE_URL);
        const { map } = await renderApp('#m=8/41.7/44.8&l=Tt/Hs');
        await expect.element(page.getByText('Tracestrack Topo is unavailable')).toBeVisible();
        await expect.element(page.getByText('Switched to OpenStreetMap')).toBeVisible();
        expect(page.getByText('Map tiles failed to load').all()).toHaveLength(0);
        await expect.poll(() => map.getLayer('O')).toBeDefined();
        expect(map.getLayer('Tt')).toBeUndefined();
        expect(map.getLayer('Hs')).toBeDefined();
        // откат — не выбор: в адресе и в localStorage осталась подложка Tracestrack
        expect(location.hash).toContain('l=Tt/Hs');
        expect(JSON.parse(localStorage.getItem('nakarte-web:layers') ?? '').selection).toEqual({
            base: 'Tt',
            overlays: ['Hs'],
        });
        await expect.poll(() => tiles.requested.some((url) => url.includes('tile.openstreetmap.org'))).toBe(true);
    });

    test('Тайла нет', async () => {
        tiles.respond(TRACESTRACK, MISSING_URL);
        const { map } = await renderApp();
        await expect.poll(() => tiles.requested.some((url) => TRACESTRACK.test(url))).toBe(true);
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(map.getLayer('Tt')).toBeDefined();
        expect(page.getByText('Tracestrack Topo is unavailable').all()).toHaveLength(0);
        expect(page.getByText('Map tiles failed to load').all()).toHaveLength(0);
    });
});
