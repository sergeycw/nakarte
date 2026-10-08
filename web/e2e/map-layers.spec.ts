import { CORS_PROXY_URL, CUSTOM_TILE_HOST, expect, test } from './fixtures.ts';

// Названия тестов — сценарии спеки map-layers (openspec/specs/map-layers/spec.md). Тайлы всех слоёв — фикстура
// (e2e/fixtures.ts).

const canvas = '.maplibregl-canvas';

// код своего слоя в формате старого клиента: -cs + URL-safe base64 от JSON полей формы
function customLayerCode(fields: Record<string, unknown>) {
    return `-cs${btoa(JSON.stringify(fields)).replace(/\+/g, '-').replace(/\//g, '_')}`;
}

const CUSTOM_OVERLAY = customLayerCode({
    name: 'Custom overlay',
    url: `https://${CUSTOM_TILE_HOST}/{z}/{x}/{y}.png`,
    tms: false,
    scaleDependent: false,
    maxZoom: 18,
    isOverlay: true,
    isTop: true,
});

function hashOf(page: { url(): string }) {
    return new URL(page.url()).hash;
}

async function openSwitcher(page: import('@playwright/test').Page) {
    await page.getByTestId('layers-button').click();
    const switcher = page.getByTestId('layer-switcher');
    await expect(switcher).toBeVisible();
    return switcher;
}

test('Первый заход без настроек', async ({ page, network }) => {
    await page.goto('./');
    await expect.poll(() => hashOf(page)).toBe('#m=8/49.73868/33.45886&l=O');
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(0);
    expect(network.tiles.every((tile) => tile.code === 'O')).toBe(true);
});

test('Список слоёв', async ({ page }) => {
    await page.goto('./');
    const switcher = await openSwitcher(page);
    await switcher.getByText('Configure layers').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('checkbox')).toHaveCount(31);
    for (const title of ['Yandex map', 'Yandex Satellite', 'Wikimapia', 'Soviet topo maps grid']) {
        await expect(dialog.getByText(title, { exact: true })).toHaveCount(0);
    }
    await expect(dialog.getByText('Relief shading')).toBeVisible();
});

test('Ссылка со слоями', async ({ page, network }) => {
    await page.goto('./#m=13/49.80930/86.47562&l=Otm/Wp');
    await expect.poll(() => hashOf(page)).toBe('#m=13/49.80930/86.47562&l=Otm');
    await expect.poll(() => network.tilesOf('Otm').length).toBeGreaterThan(0);
    expect(network.tilesOf('O')).toEqual([]);
});

test('Ссылка с удалённым слоем', async ({ page, network }) => {
    for (const layers of ['O/F', 'O/Wp']) {
        await page.goto(`./#m=8/49.73868/33.45886&l=${layers}`);
        await expect.poll(() => hashOf(page)).toBe('#m=8/49.73868/33.45886&l=O');
    }
    await expect(page.locator(canvas)).toBeVisible();
    expect(network.tiles.every((tile) => tile.code === 'O')).toBe(true);
});

test('Ссылка только с удалённым слоем', async ({ page, network }) => {
    for (const layers of ['F', 'Y']) {
        await page.goto(`./#m=8/49.73868/33.45886&l=${layers}`);
        await expect.poll(() => hashOf(page)).toBe('#m=8/49.73868/33.45886&l=O');
    }
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(0);
});

test('Ссылка со своим слоем', async ({ page, network }) => {
    await page.goto(`./#m=8/49.73868/33.45886&l=O/${CUSTOM_OVERLAY}`);
    await expect.poll(() => network.tilesOf('custom').length).toBeGreaterThan(0);
    expect(network.tilesOf('custom').every((url) => url.startsWith(`https://${CUSTOM_TILE_HOST}/`))).toBe(true);
    const switcher = await openSwitcher(page);
    await expect(switcher.getByRole('checkbox', { name: 'Custom overlay' })).toBeChecked();
});

test('Перезагрузка без l=', async ({ page, network }) => {
    await page.goto('./');
    const switcher = await openSwitcher(page);
    await switcher.getByText('ESRI Satellite').click();
    await switcher.getByText('Relief shading').click();
    await expect.poll(() => hashOf(page)).toContain('l=E/Hs');
    await page.goto('about:blank');
    await page.goto('./');
    await expect.poll(() => hashOf(page)).toBe('#m=8/49.73868/33.45886&l=E/Hs');
    await expect.poll(() => network.tilesOf('Hs').length).toBeGreaterThan(0);
});

test('Сохранённые настройки со старыми кодами', async ({ page }) => {
    const legacy = {
        layers: [
            { code: 'T', isCustom: false, enabled: true, hotkey: null },
            { code: 'F', isCustom: false, enabled: true, hotkey: null },
            { code: 'Wp', isCustom: false, enabled: true, hotkey: null },
            { code: 'Co', isCustom: false, enabled: false, hotkey: null },
            { code: CUSTOM_OVERLAY, isCustom: true, enabled: true, hotkey: null },
        ],
    };
    await page.addInitScript((value) => {
        if (!localStorage.getItem('nakarte-web:layers')) {
            localStorage.setItem('leafletLayersSettings', value);
        }
    }, JSON.stringify(legacy));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    const switcher = await openSwitcher(page);
    await expect(switcher.getByText('Custom overlay')).toBeVisible();
    await expect(switcher.getByText('CyclOSM')).toHaveCount(0);
    await expect(switcher.getByText('ESRI Satellite')).toBeVisible();
    expect(errors).toEqual([]);
});

test('Слой Strava', async ({ page, network }) => {
    await page.goto('./#m=8/49.73868/33.45886&l=O/Sa');
    await expect.poll(() => network.tilesOf('Sa').length).toBeGreaterThan(0);
    for (const url of network.tilesOf('Sa')) {
        expect(url.startsWith(`${CORS_PROXY_URL}https/content-a.strava.com/`)).toBe(true);
    }
});

test('Региональный слой вне покрытия', async ({ page, network }) => {
    await page.goto('./#m=15/41.68700/44.77600&l=O/Nm');
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');
    expect(network.tilesOf('Nm')).toEqual([]);
});

test('Слой с минимальным зумом', async ({ page, network }) => {
    await page.goto('./#m=10/54.45900/-3.02400&l=O/Gbt');
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(0);
    await page.waitForLoadState('networkidle');
    expect(network.tilesOf('Gbt')).toEqual([]);
    const switcher = await openSwitcher(page);
    await expect(switcher.getByText('zoom ≥ 12')).toBeVisible();
});

test.describe('свой слой без CORS', () => {
    async function addCustomLayer(page: import('@playwright/test').Page) {
        await page.goto('./');
        const switcher = await openSwitcher(page);
        await switcher.getByText('Add custom layer').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Tile url template').fill(`https://${CUSTOM_TILE_HOST}/{z}/{x}/{y}.png`);
        await dialog.getByText('Overlay', { exact: true }).click();
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        return dialog;
    }

    test('Сервер без CORS', async ({ page, network }) => {
        network.customWithoutCors();
        const dialog = await addCustomLayer(page);
        await expect(dialog.getByRole('alert')).toContainText('no CORS');
        await expect(dialog.getByRole('checkbox', { name: 'Use proxy' })).toBeVisible();
    });

    test('Слой через прокси', async ({ page, network }) => {
        network.customWithoutCors();
        const dialog = await addCustomLayer(page);
        await expect(dialog.getByRole('alert')).toContainText('no CORS');
        await dialog.getByRole('checkbox', { name: 'Use proxy' }).click();
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect(dialog).toHaveCount(0);
        await expect
            .poll(() => network.tilesOf('custom').filter((url) => url.startsWith(CORS_PROXY_URL)).length)
            .toBeGreaterThan(1);
        await expect(page.getByText('Map tiles failed to load')).toHaveCount(0);
    });
});
