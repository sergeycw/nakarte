import { expect, test } from './fixtures.ts';

// Названия тестов — сценарии спеки web-client (openspec/changes/add-web-skeleton/specs/web-client/spec.md).

// тайл z/x/y, в который попадает точка, — формула Web Mercator из вики OSM (Slippy map tilenames)
function tileOf(lat: number, lng: number, zoom: number) {
    const n = 2 ** zoom;
    const latRad = (lat * Math.PI) / 180;
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    return `${zoom}/${x}/${y}`;
}

const canvas = '.maplibregl-canvas';

test('Открыть новое приложение', async ({ page, network }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
        if (['script', 'stylesheet'].includes(request.resourceType())) {
            scripts.push(new URL(request.url()).pathname);
        }
    });
    await page.goto('./');
    await expect(page).toHaveTitle('nakarte routing');
    await expect(page.locator(canvas)).toBeVisible();
    expect(scripts.length).toBeGreaterThan(0);
    for (const path of scripts) {
        expect(path).toMatch(/^\/next\//);
    }
    expect(network.external).toEqual([]);
});

test('Первый заход', async ({ page, network }) => {
    await page.goto('./');
    await expect(page.getByText('OpenStreetMap')).toBeVisible();
    await expect.poll(() => network.osmTiles).toContain(tileOf(49.73868, 33.45886, 8));
    const box = await page.locator(canvas).boundingBox();
    const viewport = page.viewportSize();
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
});

test.describe('на телефоне', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('Окно телефона', async ({ page }) => {
        await page.goto('./');
        await expect(page.locator(canvas)).toBeVisible();
        const box = await page.locator(canvas).boundingBox();
        expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
        const scroll = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
        }));
        expect(scroll).toEqual({ width: 390, height: 844 });
    });
});

test('Панель на карте', async ({ page }) => {
    await page.goto('./');
    const panel = page.getByTestId('info-panel');
    await expect(panel.getByText('nakarte routing')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
        'href',
        'https://github.com/sergeycw/nakarte',
    );
});

test('Сервер тайлов недоступен', async ({ page, network }) => {
    network.failOsmTiles();
    await page.goto('./');
    await expect(page.getByText('Map tiles failed to load')).toBeVisible();
    await expect.poll(() => network.osmTiles.length).toBeGreaterThan(1);
    await expect(page.getByText('Map tiles failed to load')).toHaveCount(1);
    await expect(page.locator(canvas)).toBeVisible();
});

test.describe('в тёмной теме системы', () => {
    test.use({ colorScheme: 'dark' });

    test('Тёмная тема системы', async ({ page, network }) => {
        network.failOsmTiles();
        await page.goto('./');
        const panel = page.getByTestId('info-panel');
        await expect(panel).toBeVisible();
        await expect(panel).toHaveCSS('background-color', 'oklch(1 0 0)');
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
        const toast = page.locator('[data-slot="toast"]');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveCSS('background-color', 'oklch(1 0 0)');
    });
});
