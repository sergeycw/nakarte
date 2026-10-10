import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

// Поиск, метка и линейка в собранном клоне (спеки map-search и tracks). Поисковики — сохранёнными ответами фикстуры
// network (mapy.cz через прокси клона, photon), в сеть тест не ходит. Окно Desktop Chrome 1280×720, центр карты —
// (640, 360).
const VIEW = './#m=15/41.69/44.785&l=O';

async function clickMap(page: Page, point: { x: number; y: number }) {
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y);
}

test('Ответ mapy.cz', async ({ page, network }) => {
    await page.goto(VIEW);
    await page.getByRole('combobox', { name: 'Search' }).fill('mtatsminda');
    await expect(page.getByRole('option')).toHaveCount(5);
    await expect(page.getByRole('link', { name: 'Mapy.com' })).toBeVisible();
    expect(network.searchRequests).toHaveLength(1);
    expect(network.searchRequests[0]).toContain('/https/pro.mapy.cz/suggest/?phrase=mtatsminda');
    await page.getByRole('option').first().click();
    await expect(page.getByTestId('placemark')).toContainText('Mtatsminda Park');
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('&r=41.693040/44.779477/Mtatsminda%20Park');
});

test('mapy.cz недоступен', async ({ page, network }) => {
    network.searchResponds('mapycz', { status: 502 });
    await page.goto(VIEW);
    await page.getByRole('combobox', { name: 'Search' }).fill('mtatsminda');
    await expect(page.getByRole('option')).toHaveCount(5);
    await expect(page.getByRole('link', { name: 'Photon by Komoot' })).toBeVisible();
    expect(network.searchRequests.map((url) => new URL(url).hostname)).toEqual([
        'nakarte-cors-proxy.nakarte-routing.workers.dev',
        'photon.komoot.io',
    ]);
});

test('Ссылка с меткой', async ({ page }) => {
    await page.goto(`${VIEW}&r=41.693040/44.779477/Mtatsminda%20Park`);
    await expect(page.getByTestId('placemark')).toContainText('Mtatsminda Park');
    // метка переживает перезагрузку — она в адресе
    await page.reload();
    await expect(page.getByTestId('placemark')).toContainText('Mtatsminda Park');
});

test('Измерить расстояние', async ({ page }) => {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Measure distance' }).click();
    // ≈ 3.56 м на пиксель на z15 у Тбилиси: 340 px ≈ 1.2 км
    await clickMap(page, { x: 470, y: 400 });
    await clickMap(page, { x: 810, y: 400 });
    // пока линия рисуется, длина — в редакторе верхней строки
    await expect(page.getByTestId('edit-panel')).toContainText('Ruler');
    await expect(page.getByTestId('edit-length')).toHaveText(/^1\.2\d km$/u);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('edit-panel')).toHaveCount(0);
});
