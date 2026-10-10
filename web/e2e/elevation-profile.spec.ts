import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { elevationAt, expect, openTracks, test } from './fixtures.ts';

// Профиль высот и GPX с высотами со сборкой клона: сервис высот — заглушка фикстуры network (высота — функция широты,
// elevationAt), в сеть тесты не ходят. Названия тестов — сценарии спек tracks, track-files и route-editing (design
// add-web-elevation-profile).

// saveNktk({name: 'Mtatsminda', segments: [[41.69, 44.79 → 41.695, 44.786]], points: [TV tower 41.6945, 44.786]}):
// строкой, потому что e2e собирается как Node-модуль (nodenext), а src/tracks/ импортирует без расширений
const TBILISI = 'RAoCEAESNgoKTXRhdHNtaW5kYRIQCgbele0B0gMSBorn_gHzAhoWCICZ7QEQluT-ARoKGghUViB0b3dlcg==';
const VIEW = './#m=15/41.69/44.785';
const START = { x: 540, y: 420 };
const FINISH = { x: 740, y: 400 };

const panel = (page: Page) => page.getByTestId('elevation-profile');
const stat = (page: Page, key: string) => panel(page).locator(`[data-stat="${key}"]`);

async function trackMenu(page: Page, name: string, item: string) {
    await openTracks(page);
    await page.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: item, exact: true }).click();
}

test('Профиль трека', async ({ page, network }) => {
    await page.goto(`./#m=15/41.692/44.788&nktk=${TBILISI}`);
    await trackMenu(page, 'Mtatsminda', 'Show elevation profile');
    await expect(stat(page, 'distance')).toHaveText(/^0\.\d\d km$/);
    expect(network.elevationRequests).toHaveLength(1);
    // высоты заглушки: 41.69 → 900 м, 41.695 → 950 м
    await expect(stat(page, 'start')).toHaveText(`${Math.round(elevationAt(41.69))} m`);
    await expect(stat(page, 'finish')).toHaveText(`${Math.round(elevationAt(41.695))} m`);
    await expect(panel(page).getByRole('link', { name: /viewfinderpanoramas/ })).toBeVisible();
    // Курсор на графике: метка на карте
    const graph = await page.getByTestId('profile-graph').boundingBox();
    if (!graph) {
        throw new Error('нет графика');
    }
    await page.mouse.move(graph.x + graph.width / 2, graph.y + 30);
    await expect(page.getByTestId('profile-marker')).toBeVisible();
    await expect(page.getByTestId('profile-cursor-label')).toContainText('925 m');
});

test('Профиль отрезка', async ({ page, network }) => {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'New track' }).first().click();
    for (const point of [START, FINISH]) {
        await page.mouse.move(point.x, point.y);
        await page.mouse.click(point.x, point.y);
    }
    await page.keyboard.press('Escape');
    // меню опорной точки — по стору, без отрисованного кадра
    await page.mouse.move(FINISH.x, FINISH.y);
    await page.mouse.click(FINISH.x, FINISH.y, { button: 'right' });
    await page.getByTestId('map-menu').getByRole('menuitem', { name: 'Show elevation profile for segment' }).click();
    await expect(stat(page, 'distance')).toHaveText(/ km$/);
    expect(network.elevationRequests).toHaveLength(1);
    // редактирование продолжается
    await expect(page.getByTestId('edit-panel')).toBeVisible();
});

test('Сохранить с высотами', async ({ page, network }) => {
    await page.goto(`./#m=12/41.7/44.8&nktk=${TBILISI}`);
    const download = page.waitForEvent('download');
    await trackMenu(page, 'Mtatsminda', 'Save as GPX with elevation');
    const file = await download;
    expect(file.suggestedFilename()).toBe('Mtatsminda.gpx');
    const content = readFileSync(await file.path(), 'utf8');
    expect(network.elevationRequests).toHaveLength(1);
    expect(network.elevationRequests[0].split('\n')).toHaveLength(3);
    // у точки трека и обеих точек отрезка — <ele> заглушки
    expect(content.match(/<ele>\d+\.\d<\/ele>/g)).toHaveLength(3);
    expect(content).toMatch(/<trkpt lat="41\.69\d{4}" lon="44\.7[89]\d{4}"><ele>9\d\d\.\d<\/ele><time>/);
});
