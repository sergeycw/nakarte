import type { Page } from '@playwright/test';
import { expect, openTracks, test } from './fixtures.ts';

// Автосохранение с настоящей перезагрузкой страницы и настоящим IndexedDB Chromium (у каждого теста свой контекст —
// своя база). Названия тестов — сценарии спек route-editing и tracks. Движок — заглушка CheerpJ (e2e/fixtures.ts):
// её маршрут уходит от прямой в сторону, поэтому проложенный отрезок заметно длиннее прямой.

// Тбилиси, зум старого клиента 15; окно Desktop Chrome 1280×720. Точки южнее NO_ROUTE_LAT заглушки прокладываются.
const VIEW = './#m=15/41.69/44.785';
const START = { x: 540, y: 420 };
const FINISH = { x: 740, y: 380 };
const MOVED = { x: 760, y: 440 };

// saveNktk({name: 'Mtatsminda', segments: [[41.69, 44.79 → 41.695, 44.786]], points: [TV tower]}) и
// saveNktk({name: 'Narikala', segments: [[41.688, 44.808 → 41.6875, 44.81]]}): строками, потому что e2e собирается
// как Node-модуль (nodenext), а src/tracks/ импортирует без расширений
const MTATSMINDA = 'RAoCEAESNgoKTXRhdHNtaW5kYRIQCgbele0B0gMSBorn_gHzAhoWCICZ7QEQluT-ARoKGghUViB0b3dlcg==';
const NARIKALA = 'RAoCEAESGwoITmFyaWthbGESDwoFopTtAS0SBpj0_gG6AQ==';

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

async function dragMap(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
}

async function trackNames(page: Page) {
    await openTracks(page);
    return page
        .getByRole('list', { name: 'Tracks' })
        .getByRole('listitem')
        .getByRole('button', { name: /^Actions for/ });
}

// длина первого трека: пока линия редактируется — из редактора в верхней строке (список тогда закрыт), иначе из списка
async function kilometers(page: Page) {
    const editing = page.getByTestId('edit-length');
    if (await editing.count()) {
        return Number.parseFloat((await editing.textContent()) ?? '');
    }
    await openTracks(page);
    const text = await page.getByRole('list', { name: 'Tracks' }).getByTestId('track-length').first().textContent();
    return Number.parseFloat(text ?? '');
}

// Сколько треков в записи автосохранения (база nakarte-web, design add-web-autosave): перед перезагрузкой тест ждёт,
// пока запись дойдёт до базы, — иначе перезагрузка обгоняет транзакцию
function savedTracks(page: Page) {
    return page.evaluate(
        () =>
            new Promise<number>((resolve) => {
                const request = indexedDB.open('nakarte-web');
                request.onsuccess = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains('autosave')) {
                        db.close();
                        resolve(-1);
                        return;
                    }
                    const get = db.transaction('autosave').objectStore('autosave').get('tracks');
                    get.onsuccess = () => {
                        db.close();
                        resolve(get.result?.tracks?.length ?? -1);
                    };
                };
                request.onerror = () => resolve(-1);
            }),
    );
}

// Трек START–FINISH, проложенный «Hiking» в воркере движка; рисование и редактирование закончены, прокладка в меню
// выключена — после перезагрузки движок не прогревается сам, и его загрузка видна только по перетаскиванию
async function drawRouted(page: Page) {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await chooseActivity(page, 'Hiking');
    await page.getByRole('button', { name: 'New track' }).first().click();
    await clickMap(page, START);
    await clickMap(page, FINISH);
    // прямая между точками ≈ 0.7 км, маршрут заглушки — заметно длиннее
    await expect.poll(() => kilometers(page)).toBeGreaterThan(2);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('edit-panel')).toHaveCount(0);
    await chooseActivity(page, 'Off: straight lines');
    await expect.poll(() => savedTracks(page)).toBe(1);
}

// Проложенный отрезок перестраивается своей активностью: прокладка в меню выключена, а перетаскивание конца всё равно
// идёт в движок (у ломаной без разметки он бы не понадобился) и даёт маршрут, а не прямую
async function expectRerouted(page: Page, engineLoadsBefore: number, network: { engineLoads: number }) {
    // клик по линии ловится по отрисованному кадру: сразу после загрузки трека его может ещё не быть
    await expect(async () => {
        await clickMap(page, START);
        await expect(page.getByTestId('edit-panel')).toBeVisible({ timeout: 1000 });
    }).toPass();
    await dragMap(page, FINISH, MOVED);
    await expect.poll(() => network.engineLoads).toBe(engineLoadsBefore + 1);
    await expect.poll(() => kilometers(page)).toBeGreaterThan(2);
}

test('Перезагрузка страницы', async ({ page, network }) => {
    await drawRouted(page);
    const length = await kilometers(page);
    await page.reload();
    await expect(await trackNames(page)).toHaveCount(1);
    expect(await kilometers(page)).toBe(length);
    await expect(page.getByRole('button', { name: 'Routing is off: lines are straight' })).toBeVisible();
    await expectRerouted(page, network.engineLoads, network);
});

test('Ссылка при сохранённом списке', async ({ page, network }) => {
    network.storage.set('narikalanarikalanarik1', NARIKALA);
    await page.goto(`./#m=12/41.7/44.8&nktk=${MTATSMINDA}`);
    await expect(await trackNames(page)).toHaveCount(1);
    await expect.poll(() => savedTracks(page)).toBe(1);
    // новый документ, а не смена хеша: about:blank между переходами
    await page.goto('about:blank');
    await page.goto('./#l=O&nktl=narikalanarikalanarik1');
    await expect(await trackNames(page)).toHaveCount(2);
    expect(
        await (await trackNames(page)).evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label'))),
    ).toEqual(['Actions for Mtatsminda', 'Actions for Narikala']);
    // без m= карта показывает трек из ссылки целиком — вид у Нарикалы, а не у Мтацминды
    await expect.poll(() => new URL(page.url()).hash).toMatch(/m=\d+(\.\d+)?\/41\.68\d+\/44\.80\d+/);
});

// База sessions — как SessionRepository старого клиента (src/lib/session-state на коммите 015be893): хранилище
// sessionData с keyPath sessionId и индексом mtime
function writeLegacySessions(page: Page, sessions: { sessionId: string; mtime: number; tracks: string }[]) {
    return page.evaluate(
        (records) =>
            new Promise<void>((resolve, reject) => {
                const request = indexedDB.open('sessions', 1);
                request.onupgradeneeded = () => {
                    const store = request.result.createObjectStore('sessionData', { keyPath: 'sessionId' });
                    store.createIndex('mtime', 'mtime', { unique: false });
                };
                request.onsuccess = () => {
                    const transaction = request.result.transaction('sessionData', 'readwrite');
                    for (const { sessionId, mtime, tracks } of records) {
                        transaction.objectStore('sessionData').put({ sessionId, mtime, data: { hash: '#', tracks } });
                    }
                    transaction.oncomplete = () => {
                        request.result.close();
                        resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                };
                request.onerror = () => reject(request.error);
            }),
        sessions,
    );
}

function legacySessionIds(page: Page) {
    return page.evaluate(
        () =>
            new Promise<unknown>((resolve, reject) => {
                const request = indexedDB.open('sessions');
                request.onsuccess = () => {
                    const keys = request.result.transaction('sessionData').objectStore('sessionData').getAllKeys();
                    keys.onsuccess = () => {
                        request.result.close();
                        resolve(keys.result);
                    };
                    keys.onerror = () => reject(keys.error);
                };
                request.onerror = () => reject(request.error);
            }),
    );
}

test('Сессия старого клиента', async ({ page }) => {
    // первый заход без сессий: своей записи не появляется, база sessions не создаётся
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await writeLegacySessions(page, [{ sessionId: 'old', mtime: Date.now(), tracks: MTATSMINDA }]);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Mtatsminda', exact: true })).toBeVisible();
    await expect(await trackNames(page)).toHaveCount(1);
    // подхваченный список записан своей записью: следующий заход не подхватывает сессию второй раз
    await expect.poll(() => savedTracks(page)).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Mtatsminda', exact: true })).toBeVisible();
    await expect(await trackNames(page)).toHaveCount(1);
    expect(await legacySessionIds(page)).toEqual(['old']);
});

test('Свой список уже есть', async ({ page }) => {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'New track' }).first().click();
    await clickMap(page, START);
    await clickMap(page, FINISH);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect.poll(() => savedTracks(page)).toBe(1);
    await writeLegacySessions(page, [{ sessionId: 'old', mtime: Date.now(), tracks: MTATSMINDA }]);
    await page.reload();
    await expect(await trackNames(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Mtatsminda', exact: true })).toHaveCount(0);
    expect(await legacySessionIds(page)).toEqual(['old']);
});

test('Несколько сессий старого клиента', async ({ page }) => {
    await page.goto(VIEW);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await writeLegacySessions(page, [
        { sessionId: 'later', mtime: Date.now(), tracks: NARIKALA },
        { sessionId: 'earlier', mtime: Date.now() - 60_000, tracks: MTATSMINDA },
    ]);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Narikala', exact: true })).toBeVisible();
    await expect(await trackNames(page)).toHaveCount(1);
});

test('Открытие ссылки', async ({ page, context, browser, network }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await drawRouted(page);
    await openTracks(page);
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
        await expect(await trackNames(second)).toHaveCount(1);
        await expect.poll(() => kilometers(second)).toBeGreaterThan(2);
        await expectRerouted(second, network.engineLoads, network);
    } finally {
        await other.close();
    }
});
