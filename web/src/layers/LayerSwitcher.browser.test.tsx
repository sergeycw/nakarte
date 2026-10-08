import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { mapLayerIds, renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import { STORAGE_KEY } from './settings';

// Переключатель слоёв на настоящей карте; тайлы — фикстура. Названия тестов — сценарии спеки map-layers.

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
});

afterEach(() => {
    vi.unstubAllGlobals();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

async function openSwitcher() {
    await page.getByTestId('layers-button').click();
    const switcher = page.getByTestId('layer-switcher');
    await expect.element(switcher).toBeVisible();
    return switcher;
}

function storedListed(listed: Record<string, boolean>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, listed, hotkeys: {}, custom: [], selection: null }));
}

describe('Подложка и оверлеи', () => {
    test('Сменить подложку', async () => {
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        await switcher.getByText('ESRI Satellite').click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        tiles.requested.length = 0;
        map.jumpTo({ zoom: 9 });
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(tiles.requested.some((url) => url.includes('arcgisonline.com'))).toBe(true);
        expect(tiles.requested.some((url) => url.includes('tile.openstreetmap.org'))).toBe(false);
        expect(location.hash).toContain('l=E');
    });

    test('Порядок оверлеев', async () => {
        storedListed({ Sa: true, Nm: true });
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        await switcher.getByText('Strava heatmap (all)').click();
        await switcher.getByText('Norway topo').click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['O', 'Nm', 'Sa']);
        expect(location.hash).toContain('l=O/Nm/Sa');
    });

    test('Включить отмывку', async () => {
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        await switcher.getByText('Relief shading').click();
        await expect.poll(() => map.getLayer('Hs')?.type).toBe('hillshade');
        await expect
            .poll(() => tiles.requested.some((url) => url.includes('elevation-tiles-prod/terrarium')))
            .toBe(true);
        await expect.element(page.getByRole('link', { name: 'Terrain: Mapzen, sources' })).toBeInTheDocument();
    });

    test('Атрибуция слоя', async () => {
        await renderApp(tiles, '#l=O/Wh');
        await expect.element(page.getByRole('link', { name: 'Waymarked Hiking Trails' })).toBeInTheDocument();
        await expect.element(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeInTheDocument();
    });

    test('Слой с минимальным зумом', async () => {
        storedListed({ Gbt: true });
        const { map } = await renderApp(tiles, '#m=10/54.45900/-3.02400&l=O/Gbt');
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(tiles.requested.some((url) => url.includes('virtualearth'))).toBe(false);
        const switcher = await openSwitcher();
        await expect.element(switcher.getByText('zoom ≥ 12')).toBeVisible();
    });

    test('клик по поповеру не двигает карту', async () => {
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        const before = map.getCenter();
        await userEvent.dblClick(switcher.element(), { position: { x: 5, y: 5 } });
        expect(map.getCenter()).toEqual(before);
    });
});

describe('Настройка списка слоёв', () => {
    test('Скрыть слой из списка', async () => {
        await renderApp(tiles);
        let switcher = await openSwitcher();
        await expect.element(switcher.getByText('CyclOSM')).toBeVisible();
        await switcher.getByText('Configure layers').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByText('CyclOSM').click();
        await dialog.getByRole('button', { name: 'Ok' }).click();
        switcher = await openSwitcher();
        await expect.element(switcher.getByText('ESRI Satellite')).toBeVisible();
        expect(switcher.getByText('CyclOSM').elements()).toHaveLength(0);

        // после перезагрузки — тоже скрыт
        await cleanup();
        await renderApp(tiles);
        switcher = await openSwitcher();
        await expect.element(switcher.getByText('ESRI Satellite')).toBeVisible();
        expect(switcher.getByText('CyclOSM').elements()).toHaveLength(0);
    });

    test('занятый хоткей не назначается', async () => {
        await renderApp(tiles);
        const switcher = await openSwitcher();
        await switcher.getByText('Configure layers').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'Hotkey for CyclOSM' }).click();
        await userEvent.keyboard('e');
        await expect.element(dialog.getByText('Hotkey "E" is already used by layer "ESRI Satellite"')).toBeVisible();
        await userEvent.keyboard('7');
        await expect.element(dialog.getByRole('button', { name: 'Hotkey for CyclOSM' })).toHaveTextContent('7');
    });
});

describe('Хоткеи слоёв', () => {
    test('Хоткей слоя', async () => {
        const { map } = await renderApp(tiles);
        await userEvent.keyboard('e');
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        await userEvent.keyboard('o');
        await expect.poll(() => mapLayerIds(map)).toEqual(['O']);
    });

    test('Хоткей в поле ввода', async () => {
        const { map } = await renderApp(tiles);
        const input = document.createElement('input');
        document.body.append(input);
        input.focus();
        await userEvent.keyboard('e');
        expect(input.value).toBe('e');
        expect(mapLayerIds(map)).toEqual(['O']);
        input.remove();
    });
});

describe('Свои слои по URL', () => {
    // Проверка CORS идёт настоящим fetch; сервер своего слоя — выдуманный, поэтому ответ подменяется, а всё
    // остальное уходит в настоящий fetch (тайлы MapLibre — на фикстуру через transformRequest)
    function stubTileServer(cors: boolean) {
        const realFetch = window.fetch.bind(window);
        vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input instanceof Request ? input.url : input);
            if (!url.includes('tiles.example.test')) {
                return realFetch(input, init);
            }
            if (!cors && init?.mode === 'cors') {
                throw new TypeError('Failed to fetch');
            }
            return new Response(null, { status: 200 });
        });
    }

    async function fillCustomLayer(url: string) {
        const switcher = await openSwitcher();
        await switcher.getByText('Add custom layer').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabelText('Tile url template').fill(url);
        await dialog.getByText('Overlay', { exact: true }).click();
        return dialog;
    }

    test('Добавить свой слой', async () => {
        stubTileServer(true);
        const { map } = await renderApp(tiles);
        const dialog = await fillCustomLayer('https://tiles.example.test/{z}/{x}/{y}.png');
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect.element(dialog).not.toBeInTheDocument();
        await expect.poll(() => mapLayerIds(map).length).toBe(2);
        await expect
            .poll(() => tiles.requested.some((url) => url.startsWith('https://tiles.example.test/')))
            .toBe(true);
        expect(location.hash).toMatch(/l=O\/-cs[A-Za-z0-9_=-]+/);
        const switcher = await openSwitcher();
        await expect.element(switcher.getByRole('checkbox', { name: /Custom layer/ })).toBeChecked();
    });

    test('Сервер без CORS', async () => {
        stubTileServer(false);
        await renderApp(tiles);
        const dialog = await fillCustomLayer('https://tiles.example.test/{z}/{x}/{y}.png');
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect
            .element(dialog.getByRole('alert'))
            .toHaveTextContent(
                'The tile server does not allow loading its tiles on other sites (no CORS). Use proxy to load them.',
            );
        await expect.element(dialog.getByText('Use proxy')).toBeVisible();
    });

    test('Неподдерживаемый шаблон', async () => {
        await renderApp(tiles);
        const dialog = await fillCustomLayer('https://tiles.example.test/z{z_1}/{x_1024}/x{x}/{y_1024}/y{y}.png');
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect
            .element(dialog.getByRole('alert'))
            .toHaveTextContent('Variables {z_1}, {x_1024}, {y_1024} are not supported');
    });
});
