import { expect, test } from './fixtures.ts';

// Street View в собранном клоне (спека street-view). Maps JavaScript API — заглушка фикстуры network
// (FAKE_GOOGLE_MAPS), тайлы покрытия — фикстура; любой другой запрос к Google валит тест. Центр карты (640, 360) —
// панорама STREET_VIEW_PANORAMAS[0].
const VIEW = './#m=15/41.693/44.78&l=O';
const CENTER = { x: 640, y: 360 };

test('Режим без панорамы', async ({ page, network }) => {
    await page.goto(VIEW);
    await page.getByRole('button', { name: 'Street View', exact: true }).click();
    await expect.poll(() => network.tilesOf('street-view-coverage').length).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('n2=_g');
    expect(network.googleApiLoads).toEqual([]);
});

test('Панорама найдена', async ({ page, network }) => {
    await page.goto(VIEW);
    await page.getByRole('button', { name: 'Street View', exact: true }).click();
    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.click(CENTER.x, CENTER.y);
    const panorama = page.getByTestId('google-panorama');
    await expect(panorama).toHaveAttribute('data-view', '41.69300,44.78000,0');
    await expect(page.getByTestId('panorama-marker')).toBeVisible();
    // пустой ключ сборки — правила режима без ключа на контейнере окна
    await expect(page.locator('.google-street-view-keyless')).toHaveCount(1);
    expect(network.googleApiLoads).toEqual([
        'https://maps.googleapis.com/maps/api/js?v=3&key=&callback=__nakarteGoogleMapsReady',
    ]);
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('n2=_g/g/41.693000/44.780000/0.0/0.0/1.0');
    // взгляд в окне поворачивает метку на карте
    await page.evaluate(() => {
        (window as unknown as { __panorama: { setPov(pov: object): void } }).__panorama.setPov({
            heading: 90,
            pitch: 0,
        });
    });
    await expect(page.getByTestId('panorama-marker')).toHaveAttribute('data-heading', '90');
});

test('Старая ссылка n=', async ({ page, network }) => {
    await page.goto(`${VIEW}&n=41.693500/44.781000/45.0/0.0/1.0`);
    await expect(page.getByTestId('google-panorama')).toHaveAttribute('data-view', '41.69350,44.78100,45');
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('n2=_g/g/41.693500/44.781000/45.0/0.0/1.0');
    expect(await page.evaluate(() => location.hash)).not.toMatch(/[#&]n=/u);
    expect(network.googleApiLoads).toHaveLength(1);
});

test('Удалённый провайдер', async ({ page, network }) => {
    await page.goto(`${VIEW}&n2=wmc`);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Street View', exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
    );
    expect(network.tilesOf('street-view-coverage')).toEqual([]);
});
