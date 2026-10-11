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

// секции оверлеев свёрнуты, пока в них ничего не включено
async function openSection(switcher: ReturnType<typeof page.getByTestId>, name: string) {
    await switcher.getByRole('button', { name, exact: true }).click();
}

function storedListed(listed: Record<string, boolean>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, listed, custom: [], selection: null }));
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

    test('Серый фон под слоями', async () => {
        // тайлы ESRI не придут никогда (404): видно, что под новой подложкой — фон, а не прежняя карта
        tiles.respond(/arcgisonline\.com/, new URL('/__status__/404/tile.png', location.href).href);
        const { map } = await renderApp(tiles);
        expect(map.getStyle().layers[0]).toMatchObject({
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#ddd' },
        });
        const switcher = await openSwitcher();
        await switcher.getByText('ESRI Satellite').click();
        // прежняя подложка уходит сразу, без ожидания загрузки новой
        await expect.poll(() => mapLayerIds(map), { timeout: 1000 }).toEqual(['E']);
        expect(map.getStyle().layers[0].id).toBe('background');
    });

    test('Порядок оверлеев', async () => {
        storedListed({ Sa: true, Nm: true });
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        await openSection(switcher, 'Overlays');
        await switcher.getByText('Strava heatmap (all)').click();
        await openSection(switcher, 'Norway');
        await switcher.getByText('Norway topo').click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Tt', 'Nm', 'Sa']);
        expect(location.hash).toContain('l=Tt/Nm/Sa');
    });

    test('Включить отмывку', async () => {
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        await openSection(switcher, 'Overlays');
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

describe('Полный список слоёв', () => {
    test('Полный список', async () => {
        await renderApp(tiles);
        const switcher = await openSwitcher();
        await expect.element(switcher.getByText('ESRI Satellite')).toBeVisible();
        const overlays = switcher.getByRole('button', { name: 'Overlays', exact: true });
        await expect.element(overlays).toHaveAttribute('aria-expanded', 'false');
        await expect.element(switcher.getByText('Relief shading')).not.toBeVisible();
        await overlays.click();
        await expect.element(overlays).toHaveAttribute('aria-expanded', 'true');
        await expect.element(switcher.getByRole('checkbox', { name: 'Relief shading' })).toBeVisible();
        await expect.element(switcher.getByRole('button', { name: 'Configure layers' })).toBeVisible();
        await expect.element(switcher.getByRole('button', { name: 'Add custom layer' })).toBeVisible();
    });

    test('Редкие группы свёрнуты', async () => {
        storedListed({ Nm: true, Gbt: true });
        await renderApp(tiles);
        const switcher = await openSwitcher();
        const norway = switcher.getByRole('button', { name: 'Norway', exact: true });
        await expect.element(norway).toHaveAttribute('aria-expanded', 'false');
        await expect
            .element(switcher.getByRole('button', { name: 'Topo maps', exact: true }))
            .toHaveAttribute('aria-expanded', 'false');
        await expect.element(switcher.getByText('Norway topo')).not.toBeVisible();
        await norway.click();
        await expect.element(switcher.getByRole('checkbox', { name: 'Norway topo' })).toBeVisible();
        // соседняя редкая секция по-прежнему свёрнута
        await expect
            .element(switcher.getByRole('button', { name: 'Topo maps', exact: true }))
            .toHaveAttribute('aria-expanded', 'false');
    });

    test('Секция с включённым оверлеем раскрыта', async () => {
        await renderApp(tiles, '#l=O/Hs');
        const switcher = await openSwitcher();
        await expect
            .element(switcher.getByRole('button', { name: 'Overlays 1 on' }))
            .toHaveAttribute('aria-expanded', 'true');
        await expect.element(switcher.getByRole('checkbox', { name: 'Relief shading' })).toBeChecked();
        // снятие последнего включённого секцию не сворачивает
        await switcher.getByRole('checkbox', { name: 'Relief shading' }).click();
        const overlays = switcher.getByRole('button', { name: 'Overlays', exact: true });
        await expect.element(overlays).toHaveAttribute('aria-expanded', 'true');
        await expect.element(switcher.getByRole('checkbox', { name: 'Relief shading' })).not.toBeChecked();
        await switcher.getByRole('checkbox', { name: 'Relief shading' }).click();
        // свернуть можно и её; выбор держится, пока страница открыта
        await switcher.getByRole('button', { name: 'Overlays 1 on' }).click();
        await expect.element(switcher.getByText('Relief shading')).not.toBeVisible();
        await page.getByTestId('layers-button').click();
        await expect.element(switcher).not.toBeInTheDocument();
        await openSwitcher();
        await expect.element(switcher.getByText('Relief shading')).not.toBeVisible();
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
        expect(location.hash).toMatch(/l=Tt\/-cs[A-Za-z0-9_=-]+/);
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
