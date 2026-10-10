import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { parseRedirects, resolveRedirect } from '../vite/redirects.ts';
import { CORS_PROXY_URL, expect, openTracks, test } from './fixtures.ts';

// Названия тестов — сценарии спеки web-client (openspec/specs/web-client/spec.md).

// тайл z/x/y, в который попадает точка, — формула Web Mercator из вики OSM (Slippy map tilenames)
function tileOf(lat: number, lng: number, zoom: number) {
    const n = 2 ** zoom;
    const latRad = (lat * Math.PI) / 180;
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
    return `${zoom}/${x}/${y}`;
}

// тайлы подложки по умолчанию — через прокси клона, без ключа (спека map-layers, «Слои через прокси»)
const TRACESTRACK_TILES = `${CORS_PROXY_URL}https/tile.tracestrack.com/topo__/`;

const canvas = '.maplibregl-canvas';

test('Открыть приложение', async ({ page, network }) => {
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
        expect(path).toMatch(/^\/assets\//);
    }
    expect(network.external).toEqual([]);
});

test('Стенд движка', async ({ page }) => {
    await page.goto('/engine-bench.html');
    await expect(page).toHaveTitle('engine bench');
});

// vite preview файл _redirects не читает: на /next/… страница получает тот ответ, что дали бы Pages по правилам
// public/_redirects (проверено wrangler pages dev 2026-10-09). Перенос # через редирект — работа браузера.
const REDIRECTS = parseRedirects(readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8'));

async function servePagesRedirects(page: Page) {
    await page.route(
        (url) => url.hostname === 'localhost' && resolveRedirect(REDIRECTS, url.pathname) !== null,
        (route) => {
            const redirect = resolveRedirect(REDIRECTS, new URL(route.request().url()).pathname);
            return route.fulfill({ status: redirect?.status, headers: { location: redirect?.location ?? '/' } });
        },
    );
}

test('Ссылка на /next/ с параметрами', async ({ page, network }) => {
    await servePagesRedirects(page);
    await page.goto('/next/#m=13/42.68490/47.07008&l=O');
    expect(new URL(page.url()).pathname).toBe('/');
    expect(new URL(page.url()).hash).toBe('#m=13/42.68490/47.07008&l=O');
    await expect
        .poll(() => network.tilesOf('O'))
        .toContain(`https://tile.openstreetmap.org/${tileOf(42.6849, 47.07008, 13)}.png`);
});

test('Стенд по старому адресу', async ({ page }) => {
    await servePagesRedirects(page);
    await page.goto('/next/engine-bench.html');
    expect(new URL(page.url()).pathname).toBe('/engine-bench.html');
    await expect(page).toHaveTitle('engine bench');
});

// Реальные ссылки nakarte.me (фикстура разбора адреса) и параметры удалённых функций, которые «Copy link» старого
// клиента копировал вместе с # (ресёрч new-ui, п. 6): j= (JNX), min= и autoprofile (встраивание), sid= (сессия).
const OLD_LINKS = readFileSync(new URL('../src/state/fixtures/old-links.txt', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('https://'))
    .map((line) => line.slice(line.indexOf('#')));
const REMOVED_FEATURE_LINKS = [
    '#m=12/41.69/44.78&l=O&j=10/12/41.6/44.7/41.8/44.9',
    '#m=12/41.69/44.78&l=O&min=1&autoprofile',
    '#m=12/41.69/44.78&l=O&sid=kq3f1x_abc123',
];
const REMOVED_PARAMS = ['p', 'j', 'min', 'autoprofile', 'sid', 'q'];
// saveNktk трека «Mtatsminda» (e2e/tracks.spec.ts): строкой, e2e собирается как Node-модуль и src/tracks/ не импортирует
const MTATSMINDA = 'RAoCEAESNgoKTXRhdHNtaW5kYRIQCgbele0B0gMSBorn_gHzAhoWCICZ7QEQluT-ARoKGghUViB0b3dlcg==';
// ключ nktl из фикстуры старых ссылок
const STORED_KEY = 'KYOMJFo4WrootHEbXrMSTA';
// ответ OSM на трек 3376100 (src/tracks/fixtures/README.md)
const OSM_TRACE = fileURLToPath(new URL('../src/tracks/fixtures/services/osm-3376100.gpx', import.meta.url));
const TRACK_LINKS: [hash: string, track: string][] = [
    [`#m=12/41.7/44.8&l=O&nktk=${MTATSMINDA}`, 'Mtatsminda'],
    [`#m=12/41.7/44.8&l=O&nktl=${STORED_KEY}`, 'Mtatsminda'],
    [
        `#m=12/41.7/44.8&l=O&nktu=${encodeURIComponent('https://www.openstreetmap.org/user/Wladich/traces/3376100')}`,
        'Test - Тест - Zkouška',
    ],
    ['#m=12/41.7/44.8&l=O&nktp=41.7/44.8/Tbilisi', 'Tbilisi'],
];

test.describe('старые ссылки', () => {
    // открывать список после каждой из десятков ссылок — лишние секунды на медленном CI: он нужен только для треков
    test.use({ tracksOpen: false });

    test('Набор реальных старых ссылок', async ({ page, network }) => {
        test.slow();
        // свои слои ссылок на чужих серверах и файлы треков по ссылкам: запросы обрываются, тесту важно, что приложение
        // открылось без исключений
        network.allowExternal();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const hash of [...OLD_LINKS, ...REMOVED_FEATURE_LINKS]) {
            // через about:blank: переход с одного # на другой страницу не перезагружает
            await page.goto('about:blank');
            await page.goto(`/${hash}`);
            await expect(page.locator(canvas), hash).toBeVisible();
            const params = new URLSearchParams(hash.slice(1));
            const after = new URLSearchParams(new URL(page.url()).hash.slice(1));
            for (const key of REMOVED_PARAMS) {
                expect(after.get(key), `${key} в ${hash}`).toBe(params.get(key));
            }
            // вид из m= сохраняется (формат приложения — 5 знаков после запятой)
            const view = /^(\d+)\/(-?\d+\.\d+)\/(-?\d+\.\d+)$/.exec(params.get('m') ?? '');
            if (view) {
                const [zoom, lat, lng] = (after.get('m') ?? '').split('/');
                expect([zoom, Number(lat).toFixed(4), Number(lng).toFixed(4)], hash).toEqual([
                    view[1],
                    Number(view[2]).toFixed(4),
                    Number(view[3]).toFixed(4),
                ]);
            }
            expect(errors, hash).toEqual([]);
        }
        expect(OLD_LINKS.length).toBeGreaterThan(50);

        // треки и панорама из параметров старых ссылок: хранилище и прокси отвечают заглушками фикстуры network
        network.storage.set(STORED_KEY, MTATSMINDA);
        network.proxyResponds('https://www.openstreetmap.org/trace/3376100/data', { path: OSM_TRACE });
        for (const [hash, name] of TRACK_LINKS) {
            await page.goto('about:blank');
            await page.goto(`/${hash}`);
            await openTracks(page);
            await expect(
                page.getByRole('list', { name: 'Tracks' }).getByRole('button', { name, exact: true }).first(),
                hash,
            ).toBeVisible();
        }
        await page.goto('about:blank');
        await page.goto('/#m=17/41.6935/44.781&l=O&n=41.693500/44.781000/45.0/0.0/1.0');
        await expect.poll(() => new URL(page.url()).hash).toMatch(/[#&]n2=_g\/g\/41\.6935/);
        expect(errors).toEqual([]);
    });
});

test('Первый заход', async ({ page, network }) => {
    await page.goto('./');
    await expect(page.getByRole('link', { name: 'Maps © Tracestrack' })).toBeVisible();
    await expect
        .poll(() => network.tilesOf('Tt'))
        .toContain(`${TRACESTRACK_TILES}${tileOf(49.73868, 33.45886, 8)}.webp`);
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

test('Сервер тайлов недоступен', async ({ page, network }) => {
    network.failTiles('O');
    await page.goto('./#l=O');
    await expect(page.getByText('Map tiles failed to load')).toBeVisible();
    await expect(page.locator('[data-slot="toast-description"]')).toHaveText('OpenStreetMap');
    await expect.poll(() => network.tilesOf('O').length).toBeGreaterThan(1);
    await expect(page.getByText('Map tiles failed to load')).toHaveCount(1);
    await expect(page.locator(canvas)).toBeVisible();
});

test('Ошибка подложки Tracestrack', async ({ page, network }) => {
    network.failTiles('Tt');
    await page.goto('./');
    await expect(page.getByText('Tracestrack Topo is unavailable')).toBeVisible();
    await expect(page.getByText('Map tiles failed to load')).toHaveCount(0);
    await expect(page.locator(canvas)).toBeVisible();
});

test.describe('в тёмной теме системы', () => {
    test.use({ colorScheme: 'dark' });

    test('Тёмная тема системы', async ({ page, network }) => {
        // тост отката подложки по умолчанию — любой тост годится для проверки темы
        network.failTiles('Tt');
        await page.goto('./');
        // стекло строки поиска, тоста и кнопки слоёв — светлое (--glass в index.css), а не тёмное
        const panel = page.getByTestId('search-bar');
        await expect(panel).toBeVisible();
        await expect(panel).toHaveCSS('background-color', 'oklch(1 0 0 / 0.74)');
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
        const toast = page.locator('[data-slot="toast"]');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveCSS('background-color', 'oklch(1 0 0 / 0.74)');
        // классы dark: компонентов shadcn не включаются темой системы (@custom-variant dark в index.css)
        await expect(page.getByTestId('layers-button')).toHaveCSS('background-color', 'oklch(1 0 0 / 0.74)');
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
        await expect.poll(() => new URL(page.url()).hash).toBe('#m=8/49.73868/33.45886&l=Tt');
    }
    await expect
        .poll(() => network.tilesOf('Tt'))
        .toContain(`${TRACESTRACK_TILES}${tileOf(49.73868, 33.45886, 8)}.webp`);
});

test('Вид пишется в адрес', async ({ page, network }) => {
    await page.goto('./#m=10/41/44&p=1');
    await expect.poll(() => new URL(page.url()).hash).toBe('#m=10/41.00000/44.00000&p=1&l=Tt');
    // тянуть карту можно, когда она загрузилась: первые тайлы запрошены
    await expect.poll(() => network.tilesOf('Tt').length).toBeGreaterThan(0);
    const box = await page.locator(canvas).boundingBox();
    if (!box) {
        throw new Error('нет холста карты');
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 + 100, { steps: 10 });
    await page.mouse.up();
    // карта уехала на юго-запад — центр севернее и восточнее, зум и остальные параметры те же
    await expect.poll(() => new URL(page.url()).hash).not.toBe('#m=10/41.00000/44.00000&p=1&l=Tt');
    expect(new URL(page.url()).hash).toMatch(/^#m=10\/41\.\d{5}\/44\.\d{5}&p=1&l=Tt$/);
});
