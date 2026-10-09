import { expect, test } from './fixtures.ts';

// Геолокация в собранном клоне с настоящим Geolocation API Chromium (спека web-client, «Где я»): Playwright выдаёт
// разрешение и положение контекста. Ошибку настоящего браузера MapLibre копирует в событие перебором полей (for…in по
// GeolocationPositionError) — тест проверяет, что код ошибки доходит до тоста.
const VIEW = './#m=10/41/44&l=O';

test('Положение получено', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.7, longitude: 44.8, accuracy: 30 });
    await page.goto(VIEW);
    await page.getByRole('button', { name: 'Find my location' }).click();
    await expect(page.locator('.maplibregl-user-location-dot')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 10_000 }).toContain('/41.70000/44.80000');
    expect(await page.evaluate(() => localStorage.getItem('nakarte-web:position'))).toBe('{"lat":41.7,"lng":44.8}');
});

test('Геолокация запрещена', async ({ page, context }) => {
    // без разрешения состояние — prompt, кнопка активна; headless Chromium на запрос отвечает отказом (код 1)
    await context.clearPermissions();
    await page.goto(VIEW);
    await page.getByRole('button', { name: 'Find my location' }).click();
    await expect(
        page.getByText('Geolocation is blocked for this site. Please, enable in browser setting.'),
    ).toBeVisible();
});
