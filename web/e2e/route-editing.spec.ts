import type { Page } from '@playwright/test';
import { expect, openTracks, test } from './fixtures.ts';

// Названия тестов — сценарии спек route-editing и routing (openspec/specs/). Сборка клона считает маршрут движком в
// браузере; рантайм CheerpJ с CDN подменён заглушкой (e2e/fixtures.ts, FAKE_CHEERPJ), поэтому воркер движка, его
// протокол и очередь — настоящие, а сети нет.

// Тбилиси, зум старого клиента 15; окно Desktop Chrome 1280×720, центр карты — (640, 360). Точки ниже центра лежат
// южнее NO_ROUTE_LAT заглушки и прокладываются, точка у верхнего края — севернее, там «нет данных района».
const VIEW = './#m=15/41.69/44.785';
const START = { x: 540, y: 420 };
const FINISH = { x: 740, y: 380 };
const NO_DATA = { x: 700, y: 200 };

async function chooseActivity(page: Page, name: string) {
    await openTracks(page);
    await page
        .getByRole('button', { name: /^Routing/ })
        .first()
        .click();
    await page.getByRole('menuitemradio', { name, exact: true }).click();
}

async function clickMap(page: Page, point: { x: number; y: number }) {
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y);
}

// длина трека: пока линия редактируется — из редактора в верхней строке (список тогда закрыт), иначе из списка
async function trackLength(page: Page) {
    const editing = page.getByTestId('edit-length');
    if (await editing.count()) {
        return editing;
    }
    await openTracks(page);
    return page.getByRole('list', { name: 'Tracks' }).getByTestId('track-length');
}

async function kilometers(page: Page) {
    return Number.parseFloat((await (await trackLength(page)).textContent()) ?? '');
}

test('Новый трек', async ({ page, network }) => {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await chooseActivity(page, 'Hiking');
    await page.getByRole('button', { name: 'New track' }).first().click();
    await clickMap(page, START);
    await clickMap(page, FINISH);
    // прямая между точками ≈ 0.7 км, маршрут заглушки уходит в сторону — заметно длиннее
    await expect.poll(() => kilometers(page)).toBeGreaterThan(2);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('edit-panel')).toHaveCount(0);
    // маршрут посчитан в воркере движка, рантайм — заглушка с адреса CDN
    expect(page.workers().map((worker) => worker.url())).toContainEqual(expect.stringContaining('engine.worker'));
    expect(network.engineLoads).toBe(1);
});

test('Нет маршрута', async ({ page }) => {
    await page.goto(VIEW);
    await chooseActivity(page, 'Hiking');
    await page.getByRole('button', { name: 'New track' }).first().click();
    await clickMap(page, START);
    await clickMap(page, NO_DATA);
    await expect(page.getByText('Routing failed: no routing data for this area')).toBeVisible();
    // отрезок остался прямой между опорными точками: длина — как у прямой
    await expect.poll(() => kilometers(page)).toBeLessThan(1);
    await expect.poll(() => kilometers(page)).toBeGreaterThan(0);
});

test('Отмена клика', async ({ page, network }) => {
    await page.goto(VIEW);
    await page.getByRole('button', { name: 'New track' }).first().click();
    await clickMap(page, START);
    await clickMap(page, FINISH);
    await expect.poll(() => kilometers(page)).toBeGreaterThan(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(await trackLength(page)).toHaveText('0.00 km');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => kilometers(page)).toBeGreaterThan(0);
    // прокладка выключена — рантайм движка не грузится
    expect(network.engineLoads).toBe(0);
});

test('Перезагрузка страницы', async ({ page }) => {
    await page.goto(VIEW);
    await chooseActivity(page, 'Mountain bike');
    await expect(page.getByRole('button', { name: 'Routing: Mountain bike' })).toBeVisible();
    await page.reload();
    await page
        .getByRole('button', { name: /^Routing/ })
        .first()
        .click();
    await expect(page.getByRole('menuitemradio', { name: 'Mountain bike' })).toHaveAttribute('aria-checked', 'true');
});
