import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

// Инструменты линии и точки трека со сборкой клона: настоящие перезагрузка, IndexedDB и «Copy link» в другом контексте
// браузера. Движок — заглушка CheerpJ (e2e/fixtures.ts), её маршрут уходит от прямой в сторону. Названия тестов —
// сценарии спек route-editing и tracks (design add-web-line-tools).

// Тбилиси, зум старого клиента 15; окно Desktop Chrome 1280×720. Точки южнее NO_ROUTE_LAT заглушки прокладываются.
const VIEW = './#m=15/41.69/44.785';
const START = { x: 540, y: 420 };
const MIDDLE = { x: 640, y: 470 };
const FINISH = { x: 740, y: 400 };
const SECOND_START = { x: 560, y: 560 };
const SECOND_FINISH = { x: 760, y: 600 };
const SPOT = { x: 900, y: 500 };

type Point = { x: number; y: number };

async function chooseActivity(page: Page, name: string) {
    await page.getByRole('button', { name: /^Routing/ }).click();
    await page.getByRole('menuitemradio', { name, exact: true }).click();
}

async function clickMap(page: Page, point: Point, button: 'left' | 'right' = 'left') {
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y, { button });
}

async function dragMap(page: Page, from: Point, to: Point) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
}

async function menuItem(page: Page, name: string) {
    await page.getByTestId('map-menu').getByRole('menuitem', { name, exact: true }).click();
}

// Запись автосохранения (база nakarte-web, design add-web-autosave): по треку — состояния отрезков разметки каждого
// отрезка трека (null — ломаная без разметки) и названия точек. Перед перезагрузкой тест ждёт, пока запись дойдёт до
// базы, — иначе перезагрузка обгоняет транзакцию.
interface Saved {
    legs: (string[] | null)[];
    points: string[];
}

function saved(page: Page) {
    return page.evaluate(
        () =>
            new Promise<Saved[] | null>((resolve) => {
                const request = indexedDB.open('nakarte-web');
                request.onsuccess = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains('autosave')) {
                        db.close();
                        resolve(null);
                        return;
                    }
                    const get = db.transaction('autosave').objectStore('autosave').get('tracks');
                    get.onsuccess = () => {
                        db.close();
                        type Track = {
                            routes: ({ legs: { state: string }[] } | null)[];
                            points: { name: string }[];
                        };
                        const tracks = (get.result?.tracks ?? null) as Track[] | null;
                        resolve(
                            tracks?.map((track) => ({
                                legs: track.routes.map((route) => route?.legs.map((leg) => leg.state) ?? null),
                                points: track.points.map((point) => point.name),
                            })) ?? null,
                        );
                    };
                };
                request.onerror = () => resolve(null);
            }),
    );
}

async function kilometers(page: Page) {
    const text = await page.getByRole('list', { name: 'Tracks' }).getByTestId('track-length').first().textContent();
    return Number.parseFloat(text ?? '');
}

// клик по линии ловится по отрисованному кадру: сразу после загрузки трека его может ещё не быть
async function startEditing(page: Page, at: Point) {
    await expect(async () => {
        await clickMap(page, at);
        await expect(page.getByTestId('edit-panel')).toBeVisible({ timeout: 1000 });
    }).toPass();
}

// Трек START–MIDDLE–FINISH, проложенный «Hiking»; рисование закончено, редактирование продолжается
async function drawRouted(page: Page) {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await chooseActivity(page, 'Hiking');
    await page.getByRole('button', { name: 'New track' }).first().click();
    for (const point of [START, MIDDLE, FINISH]) {
        await clickMap(page, point);
    }
    await expect.poll(() => saved(page)).toEqual([{ legs: [['routed', 'routed']], points: [] }]);
    await page.keyboard.press('Escape');
}

test('Перезагрузка после разреза', async ({ page, network }) => {
    await drawRouted(page);
    await clickMap(page, MIDDLE, 'right');
    await menuItem(page, 'Cut');
    await page.getByRole('button', { name: 'Done' }).click();
    await chooseActivity(page, 'Off: straight lines');
    await expect.poll(() => saved(page)).toEqual([{ legs: [['routed'], ['routed']], points: [] }]);
    await page.reload();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    // прокладка выключена, а перетаскивание конца второй половины идёт в движок: она размечена как маршрут
    const loads = network.engineLoads;
    await startEditing(page, FINISH);
    await dragMap(page, FINISH, { x: 780, y: 440 });
    await expect.poll(() => network.engineLoads).toBe(loads + 1);
    await expect.poll(() => saved(page)).toEqual([{ legs: [['routed'], ['routed']], points: [] }]);
});

test('Ссылка после склейки', async ({ page, context, browser, network }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await drawRouted(page);
    await page.getByRole('button', { name: 'Done' }).click();
    // второй отрезок того же трека
    await page.getByRole('button', { name: 'Actions for New track' }).click();
    await page.getByRole('menuitem', { name: 'Add segment' }).click();
    await clickMap(page, SECOND_START);
    await clickMap(page, SECOND_FINISH);
    await expect.poll(() => saved(page)).toEqual([{ legs: [['routed', 'routed'], ['routed']], points: [] }]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    // Join от конца первого отрезка к началу второго
    await startEditing(page, START);
    await clickMap(page, FINISH, 'right');
    await menuItem(page, 'Join');
    await clickMap(page, SECOND_START);
    const joined = [{ legs: [['routed', 'routed', 'straight', 'routed']], points: [] }];
    await expect.poll(() => saved(page)).toEqual(joined);
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Tracks menu' }).click();
    await page.getByRole('menuitem', { name: 'Copy link for all tracks' }).click();
    await expect(page.getByText('Link copied')).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    // другой пользователь: свой IndexedDB, то же хранилище треков
    const other = await browser.newContext();
    try {
        await network.attach(other);
        const second = await other.newPage();
        await second.goto(link);
        await expect.poll(() => saved(second)).toEqual(joined);
        expect(await kilometers(second)).toBeCloseTo(await kilometers(page), 1);
    } finally {
        await other.close();
    }
});

test('Точка трека', async ({ page }) => {
    await drawRouted(page);
    await page.getByRole('button', { name: 'Actions for New track' }).click();
    await page.getByRole('menuitem', { name: 'Add point' }).click();
    await expect(page.getByTestId('edit-panel')).toHaveCount(0);
    await clickMap(page, SPOT);
    await expect(page.getByRole('textbox', { name: 'Point name' })).toHaveValue('001');
    await page.getByRole('textbox', { name: 'Point name' }).fill('Camp');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('point-panel')).toHaveCount(0);
    // точка на карте: клик по ней — меню с названием
    await expect(async () => {
        await clickMap(page, SPOT);
        await expect(page.getByTestId('map-menu')).toBeVisible({ timeout: 1000 });
    }).toPass();
    await menuItem(page, 'Rename');
    await page.getByRole('textbox', { name: 'Point name' }).fill('Pass');
    await page.keyboard.press('Enter');
    await expect.poll(() => saved(page)).toEqual([{ legs: [['routed', 'routed']], points: ['Pass'] }]);
    await page.reload();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect(async () => {
        await clickMap(page, SPOT);
        await expect(page.getByTestId('map-menu').getByText('Pass', { exact: true })).toBeVisible({ timeout: 1000 });
    }).toPass();
});

// Настоящее касание (CDP Input.dispatchTouchEvent): после отпускания пальца браузер шлёт совместимые mousedown/click,
// и без preventDefault у touchend меню Base UI закрывалось сразу (синтетические TouchEvent browser-тестов этого не ловят)
test('Долгое нажатие', async ({ browser, network }) => {
    const phone = await browser.newContext({ ...devices['Pixel 7'] });
    try {
        await network.attach(phone);
        await phone.addInitScript(() => localStorage.setItem('nakarte-web:routing-activity', ''));
        const page = await phone.newPage();
        await page.goto(VIEW);
        await expect(page.locator('.maplibregl-canvas')).toBeVisible();
        await page.getByRole('button', { name: 'New track' }).first().tap();
        const points = [
            { x: 120, y: 520 },
            { x: 200, y: 600 },
            { x: 280, y: 520 },
        ];
        for (const point of points) {
            await page.touchscreen.tap(point.x, point.y);
        }
        await expect.poll(() => saved(page)).toEqual([{ legs: [null], points: [] }]);
        const before = await kilometers(page);
        const cdp = await phone.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[1]] });
        await expect(page.getByTestId('map-menu')).toBeVisible();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        // меню осталось открытым, точка не сдвинулась и новой не появилось
        await page.waitForTimeout(500);
        await expect(page.getByTestId('map-menu')).toBeVisible();
        await page.getByRole('menuitem', { name: 'Delete point' }).tap();
        await expect(page.getByTestId('map-menu')).toHaveCount(0);
        // средняя точка удалена: линия — прямая между крайними
        await expect.poll(() => kilometers(page)).toBeLessThan(before);
        // вне редактирования долгое нажатие на линию считает сам MapLibre (contextmenu карты): начинается
        // редактирование, открывается меню линии
        await page.getByRole('button', { name: 'Done' }).tap();
        await expect(page.getByTestId('edit-panel')).toHaveCount(0);
        const onLine = { x: 200, y: 520 };
        // попадание по линии — по отрисованному кадру: после Done дать карте перерисоваться
        await page.waitForTimeout(800);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [onLine] });
        await expect(page.getByTestId('map-menu')).toBeVisible();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(500);
        await expect(page.getByTestId('map-menu')).toHaveCount(1);
        await expect(page.getByRole('menuitem', { name: 'Cut', exact: true })).toBeVisible();
        await expect(page.getByTestId('edit-panel')).toBeVisible();
    } finally {
        await phone.close();
    }
});
