import type { MapRef } from '@vis.gl/react-maplibre';
import { createRef } from 'react';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { App } from './App';
// стили приложения нужны тесту целиком: проверяется, как Tailwind и CSS MapLibre уживаются на одной странице
import './index.css';
import tileFixture from './test/tile.png?url';

// Настоящая карта MapLibre в Chromium; тайлы — локальная фикстура, в сеть тест не ходит.
const TILE_URL = new URL(tileFixture, location.href).href;
const MISSING_TILE_URL = new URL('/__missing__/{z}/{x}/{y}.png', location.href).href;

async function renderApp(tileUrl = TILE_URL) {
    const mapRef = createRef<MapRef>();
    const screen = await render(<App tileUrl={tileUrl} mapRef={mapRef} />);
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
        await expect.element(page.getByText('OpenStreetMap')).toBeVisible();
    });

    test('Клик по панели', async () => {
        const { map } = await renderApp();
        const panel = page.getByTestId('info-panel');
        await expect.element(panel).toBeVisible();

        const panelElement = panel.element();
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
        await userEvent.click(panelElement, { position: { x: 5, y: 5 } });
        await userEvent.dblClick(panelElement, { position: { x: 5, y: 5 } });
        expect(map.getCenter()).toEqual(before);
        expect(map.getZoom()).toBe(7);
    });
});

describe('Тост при ошибке тайлов', () => {
    test('Сервер тайлов недоступен', async () => {
        const { map } = await renderApp(MISSING_TILE_URL);
        await expect.element(page.getByText('Map tiles failed to load')).toBeVisible();

        // новые тайлы — новые ошибки, но тост остаётся один
        map.jumpTo({ zoom: 10 });
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(page.getByText('Map tiles failed to load').all()).toHaveLength(1);
        expect(map.getZoom()).toBe(10);
    });
});
