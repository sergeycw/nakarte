import { expect, test } from './fixtures.ts';

// Названия тестов — сценарии спеки web-client (openspec/specs/web-client/spec.md).

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
    await expect
        .poll(() => network.tilesOf('O'))
        .toContain(`https://tile.openstreetmap.org/${tileOf(49.73868, 33.45886, 8)}.png`);
    await expect(page.getByText('Map tiles failed to load')).toHaveCount(0);
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
    network.failTiles('O');
    await page.goto('./');
    await expect(page.getByText('Map tiles failed to load')).toBeVisible();
    await expect(page.locator('[data-slot="toast-description"]')).toHaveText('OpenStreetMap');
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(1);
    await expect(page.getByText('Map tiles failed to load')).toHaveCount(1);
    await expect(page.locator(canvas)).toBeVisible();
});

test.describe('в тёмной теме системы', () => {
    test.use({ colorScheme: 'dark' });

    test('Тёмная тема системы', async ({ page, network }) => {
        network.failTiles('O');
        await page.goto('./');
        const panel = page.getByTestId('info-panel');
        await expect(panel).toBeVisible();
        await expect(panel).toHaveCSS('background-color', 'oklch(1 0 0)');
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
        const toast = page.locator('[data-slot="toast"]');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveCSS('background-color', 'oklch(1 0 0)');
        // классы dark: компонентов shadcn не включаются темой системы (@custom-variant dark в index.css)
        await expect(page.getByTestId('layers-button')).toHaveCSS('background-color', 'oklch(1 0 0)');
    });
});

test('Ссылка с видом', async ({ page, network }) => {
    await page.goto('./#m=13/42.68490/47.07008&l=O');
    await expect
        .poll(() => network.tilesOf('O'))
        .toContain(`https://tile.openstreetmap.org/${tileOf(42.6849, 47.07008, 13)}.png`);
    expect(network.tilesOf('O').every((url) => url.includes('/13/'))).toBe(true);
});

test('Неверный вид в ссылке', async ({ page, network }) => {
    // второй адрес отличается только #: страница не перезагружается, приложение получает hashchange
    for (const hash of ['#m=99/49.44893/52.5547', '#m=11/49.44893/']) {
        await page.goto(`./${hash}`);
        await expect.poll(() => new URL(page.url()).hash).toBe('#m=8/49.73868/33.45886&l=O');
    }
    await expect
        .poll(() => network.tilesOf('O'))
        .toContain(`https://tile.openstreetmap.org/${tileOf(49.73868, 33.45886, 8)}.png`);
});

test('Вид пишется в адрес', async ({ page, network }) => {
    await page.goto('./#m=10/41/44&p=1');
    await expect.poll(() => new URL(page.url()).hash).toBe('#m=10/41.00000/44.00000&p=1&l=O');
    // тянуть карту можно, когда она загрузилась: первые тайлы запрошены
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(0);
    const box = await page.locator(canvas).boundingBox();
    if (!box) {
        throw new Error('нет холста карты');
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 + 100, { steps: 10 });
    await page.mouse.up();
    // карта уехала на юго-запад — центр севернее и восточнее, зум и остальные параметры те же
    await expect.poll(() => new URL(page.url()).hash).not.toBe('#m=10/41.00000/44.00000&p=1&l=O');
    expect(new URL(page.url()).hash).toMatch(/^#m=10\/41\.\d{5}\/44\.\d{5}&p=1&l=O$/);
});
