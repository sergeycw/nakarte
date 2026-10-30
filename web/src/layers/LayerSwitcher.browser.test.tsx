import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { mapLayerIds, renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import { serializeCustomLayer } from './custom';
import { STORAGE_KEY } from './settings';

// Переключатель слоёв на настоящей карте; тайлы — фикстура. Названия тестов — сценарии спеки map-layers.

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
});

afterEach(() => {
    vi.unstubAllGlobals();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

async function openSwitcher() {
    await page.getByTestId('layers-button').click();
    const switcher = page.getByTestId('layer-switcher');
    await expect.element(switcher).toBeVisible();
    return switcher;
}

function storedListed(listed: Record<string, boolean>) {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, groupDefaults: true, listed, custom: [], selection: null }),
    );
}

describe('Подложка и оверлеи', () => {
    test('Сменить подложку', async () => {
        const { map } = await renderApp(tiles);
        // подложки каталога — в кругах столбца (design custom-bases-in-list)
        await page.getByRole('button', { name: 'ESRI Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        tiles.requested.length = 0;
        map.jumpTo({ zoom: 9 });
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(tiles.requested.some((url) => url.includes('arcgisonline.com'))).toBe(true);
        expect(tiles.requested.some((url) => url.includes('tile.openstreetmap.org'))).toBe(false);
        expect(location.hash).toContain('l=E');
    });

    test('Серый фон под слоями', async () => {
        // тайлы ESRI не придут никогда (404): видно, что под новой подложкой — фон, а не прежняя карта
        tiles.respond(/arcgisonline\.com/, new URL('/__status__/404/tile.png', location.href).href);
        const { map } = await renderApp(tiles);
        expect(map.getStyle().layers[0]).toMatchObject({
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#ddd' },
        });
        await page.getByRole('button', { name: 'ESRI Satellite', exact: true }).click();
        // прежняя подложка уходит сразу, без ожидания загрузки новой
        await expect.poll(() => mapLayerIds(map), { timeout: 1000 }).toEqual(['E']);
        expect(map.getStyle().layers[0].id).toBe('background');
    });

    test('Порядок оверлеев', async () => {
        storedListed({ Sa: true, Nm: true });
        const { map } = await renderApp(tiles);
        // хитмэп Strava — кнопкой столбца: в All layers хитмэпов нет (design custom-bases-in-list)
        await page.getByRole('button', { name: 'Strava heatmap (all)', exact: true }).click();
        const switcher = await openSwitcher();
        await switcher.getByText('Norway topo').click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of', 'Nm', 'Sa']);
        expect(location.hash).toContain('l=Of/Nm/Sa');
    });

    test('Включить отмывку', async () => {
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        await switcher.getByText('Relief shading').click();
        await expect.poll(() => map.getLayer('Hs')?.type).toBe('hillshade');
        await expect
            .poll(() => tiles.requested.some((url) => url.includes('elevation-tiles-prod/terrarium')))
            .toBe(true);
        await expect.element(page.getByRole('link', { name: 'Terrain: Mapzen, sources' })).toBeInTheDocument();
    });

    test('Атрибуция слоя', async () => {
        await renderApp(tiles, '#l=O/Wh');
        await expect.element(page.getByRole('link', { name: 'Waymarked Hiking Trails' })).toBeInTheDocument();
        await expect.element(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeInTheDocument();
    });

    test('Слой с минимальным зумом', async () => {
        storedListed({ Gbt: true });
        const { map } = await renderApp(tiles, '#m=10/54.45900/-3.02400&l=O/Gbt');
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(tiles.requested.some((url) => url.includes('virtualearth'))).toBe(false);
        const switcher = await openSwitcher();
        await expect.element(switcher.getByText('zoom ≥ 12')).toBeVisible();
    });

    test('клик по поповеру не двигает карту', async () => {
        const { map } = await renderApp(tiles);
        const switcher = await openSwitcher();
        const before = map.getCenter();
        await userEvent.dblClick(switcher.element(), { position: { x: 5, y: 5 } });
        expect(map.getCenter()).toEqual(before);
    });
});

describe('Полный список слоёв', () => {
    test('Полный список', async () => {
        await renderApp(tiles);
        const switcher = await openSwitcher();
        // без своих слоёв подложек в панели нет
        await expect.element(switcher.getByRole('button', { name: 'Configure layers' })).toBeVisible();
        expect(switcher.getByText('ESRI Satellite').elements()).toHaveLength(0);
        expect(switcher.getByRole('radiogroup').elements()).toHaveLength(0);
        // оверлеи видны сразу, секция — заголовок, а не кнопка
        await expect.element(switcher.getByRole('group', { name: 'Overlays' })).toBeVisible();
        await expect.element(switcher.getByRole('checkbox', { name: 'Relief shading' })).toBeVisible();
        expect(switcher.getByRole('button', { name: 'Overlays' }).elements()).toHaveLength(0);
        await expect.element(switcher.getByRole('button', { name: 'Add custom layer' })).toBeVisible();
    });

    test('Хитмэпов в списке нет', async () => {
        await renderApp(tiles, '#m=8/46/8&l=Tt/Sa');
        await expect.poll(() => heatmapButton()?.getAttribute('aria-pressed')).toBe('true');
        const switcher = await openSwitcher();
        await expect.element(switcher.getByRole('checkbox', { name: 'Relief shading' })).toBeVisible();
        expect(switcher.getByText(/Strava/).elements()).toHaveLength(0);
    });

    test('Своя подложка в списке', async () => {
        const code = serializeCustomLayer({
            name: 'My winter map',
            url: 'https://tiles.example.test/{z}/{x}/{y}.png',
            tms: false,
            scaleDependent: false,
            maxZoom: 18,
            isOverlay: false,
            isTop: false,
        });
        const { map } = await renderApp(tiles, `#m=8/46/8&l=${code}`);
        await page.getByRole('button', { name: 'ESRI Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        const switcher = await openSwitcher();
        const radio = switcher.getByRole('radio', { name: 'My winter map' });
        await expect.element(radio).not.toBeChecked();
        expect(switcher.getByText('ESRI Satellite').elements()).toHaveLength(0);
        await switcher.getByText('My winter map').click();
        await expect.poll(() => mapLayerIds(map)).toEqual([code]);
    });

    test('Оверлеи без сворачивания', async () => {
        storedListed({ Nm: true, Gbt: true });
        await renderApp(tiles, '#m=8/46/8&l=Tt/Hs');
        const switcher = await openSwitcher();
        // и обычные, и редкие группы раскрыты, свернуть нечего
        await expect.element(switcher.getByRole('group', { name: 'Overlays' })).toBeVisible();
        await expect.element(switcher.getByRole('checkbox', { name: 'Relief shading' })).toBeChecked();
        await expect.element(switcher.getByRole('group', { name: 'Norway' })).toBeVisible();
        await expect.element(switcher.getByRole('checkbox', { name: 'Norway topo' })).toBeVisible();
        await expect.element(switcher.getByRole('group', { name: 'Topo maps' })).toBeVisible();
        // у строки с минимальным зумом подпись — «Great Britain Topo zoom ≥ 12», а имя browser mode сравнивает целиком
        await expect.element(switcher.getByRole('checkbox', { name: /^Great Britain Topo/u })).toBeVisible();
        expect(switcher.element().querySelectorAll('[aria-expanded]')).toHaveLength(0);
    });
});

describe('Единый вид меню', () => {
    test('Строки списка и пункты меню одной высоты', async () => {
        await renderApp(tiles);
        // offsetHeight — в CSS-пикселях: окно browser-теста масштабируется, и getBoundingClientRect даёт меньше
        const size = (element: Element) => [(element as HTMLElement).offsetHeight, getComputedStyle(element).fontSize];
        const switcher = await openSwitcher();
        const row = size(switcher.element().querySelector('label[data-layer]') as Element);
        await switcher.getByText('Configure layers').click();
        const dialog = page.getByRole('dialog');
        await expect.element(dialog).toBeVisible();
        const dialogRow = size(dialog.element().querySelector('label') as Element);
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect.element(dialog).not.toBeInTheDocument();
        // меню открывается не в том же такте, что нажатие: под нагрузкой полного прогона пункта ещё нет — сначала ждём
        await page.getByRole('button', { name: 'Topo layers', exact: true }).click();
        const radio = page.getByRole('menuitemradio').first();
        await expect.element(radio).toBeVisible();
        const radioItem = size(radio.element());
        await userEvent.keyboard('{Escape}');
        await expect.element(radio).not.toBeInTheDocument();
        await page.getByRole('button', { name: 'Tracks menu', exact: true }).click();
        const menuItem = page.getByRole('menuitem').first();
        await expect.element(menuItem).toBeVisible();
        const item = size(menuItem.element());
        // 14 px, строка 24 px — правило единообразия меню и списков (AGENTS.md, design uniform-layer-menus)
        expect({ row, dialogRow, radioItem, item }).toEqual({
            row: [24, '14px'],
            dialogRow: [24, '14px'],
            radioItem: [24, '14px'],
            item: [24, '14px'],
        });
    });
});

// Круги подложек и кнопка хитмэпа — кнопки столбца с aria-pressed (у значков меню его нет): первые три — круги, за
// ними кнопка хитмэпа и кнопка снимков по датам (design custom-bases-in-list)
function columnButtons() {
    const group = page.getByRole('group', { name: 'Quick layers' }).element();
    return [...group.querySelectorAll('button[aria-pressed]')];
}
const circles = () => columnButtons().slice(0, 3);
const names = () => circles().map((button) => button.getAttribute('aria-label'));
const pressed = () => circles().map((button) => button.getAttribute('aria-pressed'));
const heatmapButton = () => columnButtons()[3];

// меню значка у круга или кнопки: имя значка — имя группы (quick-layers.ts)
async function openMenu(group: string) {
    await page.getByRole('button', { name: group, exact: true }).click();
    const menu = page.getByRole('menu', { name: group });
    await expect.element(menu).toBeVisible();
    return menu;
}

function menuItems(menu: ReturnType<typeof page.getByRole>) {
    return menu.getByRole('menuitemradio').elements();
}
const itemNames = (menu: ReturnType<typeof page.getByRole>) => menuItems(menu).map((item) => item.textContent);
const checkedItems = (menu: ReturnType<typeof page.getByRole>) =>
    menuItems(menu)
        .filter((item) => item.getAttribute('aria-checked') === 'true')
        .map((item) => item.textContent);

describe('Превью подложек справа', () => {
    test('Превью без настроек', async () => {
        await renderApp(tiles);
        await expect.poll(names).toEqual(['OpenFreeMap Outdoor', 'Google Map', 'ESRI Satellite']);
        expect(pressed()).toEqual(['true', 'false', 'false']);
        // у каждой из трёх подложек — картинка из сборки, а не пустой круг
        expect(circles().map((button) => button.querySelector('img')?.getAttribute('src'))).toEqual([
            expect.stringMatching(/thumbnails\/Of\.webp/),
            expect.stringMatching(/thumbnails\/G\.webp/),
            expect.stringMatching(/thumbnails\/E\.webp/),
        ]);
    });

    test('Подложка по превью', async () => {
        const { map } = await renderApp(tiles);
        await page.getByRole('button', { name: 'ESRI Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        expect(location.hash).toMatch(/l=E(&|$)/);
        expect(pressed()).toEqual(['false', 'false', 'true']);
    });

    test('Подложка группы отмечает круг', async () => {
        await renderApp(tiles, '#m=8/46/8&l=P');
        await expect.poll(names).toEqual(['OpenFreeMap Outdoor', 'Google Terrain', 'ESRI Satellite']);
        expect(pressed()).toEqual(['false', 'true', 'false']);
    });

    test('Выбранная подложка вне превью', async () => {
        const code = serializeCustomLayer({
            name: 'My winter map',
            url: 'https://tiles.example.test/{z}/{x}/{y}.png',
            tms: false,
            scaleDependent: false,
            maxZoom: 18,
            isOverlay: false,
            isTop: false,
        });
        await renderApp(tiles, `#m=8/46/8&l=${code}`);
        await expect.poll(names).toEqual(['OpenFreeMap Outdoor', 'Google Map', 'ESRI Satellite']);
        expect(pressed()).toEqual(['false', 'false', 'false']);
    });

    test('Превью без запросов тайлов', async () => {
        const { map } = await renderApp(tiles, '#m=8/46/8&l=O');
        await expect.poll(() => map.loaded(), { timeout: 10_000 }).toBe(true);
        expect(circles()).toHaveLength(3);
        expect(tiles.requested.some((url) => url.includes('tile.openstreetmap.org'))).toBe(true);
        // картинки превью — из сборки: тайлов трёх подложек столбца нет
        expect(
            tiles.requested.filter((url) => /openfreemap|tracestrack|google\.com|arcgisonline\.com/u.test(url)),
        ).toEqual([]);
    });

    test('Скрытая подложка в превью', async () => {
        storedListed({ G: false });
        const { map } = await renderApp(tiles);
        await expect.poll(names).toEqual(['OpenFreeMap Outdoor', 'Google Map', 'ESRI Satellite']);
        await page.getByRole('button', { name: 'Google Map', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['G']);
    });
});

describe('Контраст кнопок столбца', () => {
    test('Контраст кругов и значков', async () => {
        await renderApp(tiles);
        await expect.poll(names).toHaveLength(3);
        for (const circle of circles()) {
            // тёмное кольцо 1.5 px и тень (design quick-circle-contrast)
            const shadow = getComputedStyle(circle).boxShadow;
            expect(shadow).toMatch(/rgba\(0, 0, 0, 0\.45\) 0px 0px 0px 1\.5px/u);
            expect(shadow).toMatch(/rgba\(0, 0, 0, 0\.35\) 0px 1px 4px/u);
        }
        const group = page.getByRole('group', { name: 'Quick layers' }).element();
        const badges = [...group.querySelectorAll('button[aria-haspopup]')];
        expect(badges.map((badge) => badge.getAttribute('aria-label'))).toEqual([
            'Topo layers',
            'Map layers',
            'Satellite layers',
            'Strava heatmaps',
        ]);
        for (const badge of badges) {
            const style = getComputedStyle(badge);
            expect(style.color).toBe('rgb(255, 255, 255)');
            expect(style.borderTopColor).toBe('rgb(255, 255, 255)');
            expect(style.borderTopWidth).toBe('2px');
            // тёмно-серый фон — neutral-700 палитры Tailwind; оттенок серого Chromium пишет то 0, то none
            expect(style.backgroundColor).toMatch(/^oklch\(0\.371 0 (0|none)\)$/u);
            // значок поверх круга: в его середине — он сам, а не круг
            const box = badge.getBoundingClientRect();
            expect(badge.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))).toBe(true);
        }
    });
});

describe('Переключатели оверлеев справа', () => {
    test('Оверлей кнопкой', async () => {
        const { map } = await renderApp(tiles);
        await page.getByRole('button', { name: 'Strava heatmap (all)', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of', 'Sa']);
        expect(heatmapButton()?.getAttribute('aria-pressed')).toBe('true');
        await page.getByRole('button', { name: 'Strava heatmap (all)', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of']);
        expect(heatmapButton()?.getAttribute('aria-pressed')).toBe('false');
    });

    test('Кнопка хитмэпа при снятом в настройках', async () => {
        storedListed({ Sa: false });
        await renderApp(tiles);
        await expect.poll(() => heatmapButton()?.getAttribute('aria-label')).toBe('Strava heatmap (all)');
    });

    test('Снимки по датам под кнопками с меню', async () => {
        await renderApp(tiles);
        await expect
            .poll(() => columnButtons().map((button) => button.getAttribute('aria-label')))
            .toEqual([
                'OpenFreeMap Outdoor',
                'Google Map',
                'ESRI Satellite',
                'Strava heatmap (all)',
                'Satellite by date',
            ]);
    });

    test('Отмывки в столбце нет', async () => {
        const { map } = await renderApp(tiles);
        await expect.poll(names).toHaveLength(3);
        expect(page.getByRole('button', { name: 'Relief shading' }).elements()).toHaveLength(0);
        const switcher = await openSwitcher();
        await switcher.getByRole('checkbox', { name: 'Relief shading' }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of', 'Hs']);
    });
});

describe('Меню слоёв столбца', () => {
    test('Меню без настроек', async () => {
        await renderApp(tiles);
        const expected: [string, string[], string[]][] = [
            [
                'Topo layers',
                ['OpenFreeMap Outdoor', 'Tracestrack Topo', 'OpenTopoMap', 'OSM Outdoors', 'OpenCycleMap', 'CyclOSM'],
                ['OpenFreeMap Outdoor'],
            ],
            ['Map layers', ['Google Map', 'OpenStreetMap', 'Google Terrain'], []],
            ['Satellite layers', ['ESRI Satellite', 'Google Satellite', 'Bing Satellite', 'Sentinel-2 cloudless'], []],
            [
                'Strava heatmaps',
                ['Strava heatmap (all)', 'Strava heatmap (run)', 'Strava heatmap (ride)', 'Strava heatmap (winter)'],
                [],
            ],
        ];
        for (const [group, items, checked] of expected) {
            const menu = await openMenu(group);
            expect(itemNames(menu)).toEqual(items);
            expect(checkedItems(menu)).toEqual(checked);
            await userEvent.keyboard('{Escape}');
            await expect.element(menu).not.toBeInTheDocument();
        }
    });

    test('Подложка из меню', async () => {
        const { map } = await renderApp(tiles);
        const menu = await openMenu('Satellite layers');
        await menu.getByRole('menuitemradio', { name: 'Bing Satellite' }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['I']);
        expect(location.hash).toMatch(/l=I(&|$)/);
        await expect.element(menu).not.toBeInTheDocument();
        expect(pressed()).toEqual(['false', 'false', 'true']);
    });

    test('Хитмэп из меню', async () => {
        const { map } = await renderApp(tiles, '#m=8/46/8&l=Tt/Sa');
        await expect.poll(() => mapLayerIds(map)).toEqual(['Tt', 'Sa']);
        const menu = await openMenu('Strava heatmaps');
        expect(checkedItems(menu)).toEqual(['Strava heatmap (all)']);
        await menu.getByRole('menuitemradio', { name: 'Strava heatmap (ride)' }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Tt', 'Sb']);
        expect(location.hash).toMatch(/l=Tt\/Sb(&|$)/);
        expect(heatmapButton()?.getAttribute('aria-pressed')).toBe('true');
    });

    test('Скрытая подложка не в меню', async () => {
        storedListed({ Otm: false });
        await renderApp(tiles);
        const menu = await openMenu('Topo layers');
        expect(itemNames(menu)).toEqual([
            'OpenFreeMap Outdoor',
            'Tracestrack Topo',
            'OSM Outdoors',
            'OpenCycleMap',
            'CyclOSM',
        ]);
    });
});

describe('Меню слоёв столбца: перезагрузка', () => {
    test('Слой из меню после перезагрузки', async () => {
        const first = await renderApp(tiles);
        const menu = await openMenu('Topo layers');
        await menu.getByRole('menuitemradio', { name: 'OpenTopoMap' }).click();
        await expect.poll(() => mapLayerIds(first.map)).toEqual(['Otm']);
        // снять галочку слоя, который сейчас на карте: он остаётся на карте и в меню, пока выбран
        const switcher = await openSwitcher();
        await switcher.getByText('Configure layers').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByText('OpenTopoMap').click();
        await dialog.getByRole('button', { name: 'Ok' }).click();
        await expect.element(dialog).not.toBeInTheDocument();
        // перезагрузка — со своим адресом прошлого захода: приложение записало в него l=Otm
        const hash = location.hash;
        expect(hash).toMatch(/l=Otm(&|$)/);
        await cleanup();
        const { map } = await renderApp(tiles, hash);
        await expect.poll(() => mapLayerIds(map)).toEqual(['Otm']);
        await page.getByRole('button', { name: 'ESRI Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        // свой адрес прошлого захода снятую галочку не возвращает
        expect(itemNames(await openMenu('Topo layers'))).not.toContain('OpenTopoMap');
    });
});

describe('Круг помнит выбор типа', () => {
    async function pickBing(map: Awaited<ReturnType<typeof renderApp>>['map']) {
        const menu = await openMenu('Satellite layers');
        await menu.getByRole('menuitemradio', { name: 'Bing Satellite' }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['I']);
        await page.getByRole('button', { name: 'OpenFreeMap Outdoor', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of']);
    }

    test('Круг возвращает выбор', async () => {
        const { map } = await renderApp(tiles);
        await pickBing(map);
        expect(names()).toEqual(['OpenFreeMap Outdoor', 'Google Map', 'Bing Satellite']);
        await page.getByRole('button', { name: 'Bing Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['I']);
    });

    test('Кнопка хитмэпа помнит выбор', async () => {
        const { map } = await renderApp(tiles);
        const menu = await openMenu('Strava heatmaps');
        await menu.getByRole('menuitemradio', { name: 'Strava heatmap (run)' }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of', 'Sr']);
        await page.getByRole('button', { name: 'Strava heatmap (run)', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of']);
        await page.getByRole('button', { name: 'Strava heatmap (run)', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Of', 'Sr']);
        expect(heatmapButton()?.getAttribute('aria-label')).toBe('Strava heatmap (run)');
    });

    test('Память после перезагрузки', async () => {
        const first = await renderApp(tiles);
        await pickBing(first.map);
        await cleanup();
        const { map } = await renderApp(tiles);
        await expect.poll(names).toEqual(['OpenFreeMap Outdoor', 'Google Map', 'Bing Satellite']);
        await page.getByRole('button', { name: 'Bing Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['I']);
    });

    test('Откат не меняет память', async () => {
        // недоступны обе подложки цепочки: OpenFreeMap → Tracestrack → OpenStreetMap
        const unavailable = new URL('/__status__/503/tile.png', location.href).href;
        tiles.respond(/^https:\/\/tiles\.openfreemap\.org\/planet$/, unavailable);
        tiles.respond(/tracestrack/, unavailable);
        const { map } = await renderApp(tiles);
        await expect.poll(() => mapLayerIds(map)).toEqual(['O']);
        // на карте OpenStreetMap — отмечен круг обычной карты
        expect(names()).toEqual(['OpenFreeMap Outdoor', 'OpenStreetMap', 'ESRI Satellite']);
        expect(pressed()).toEqual(['false', 'true', 'false']);
        await page.getByRole('button', { name: 'ESRI Satellite', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['E']);
        await page.getByRole('button', { name: 'Google Map', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['G']);
    });

    test('круг во время отката выбирает подложку пользователя, а не подложку отката', async () => {
        tiles.respond(
            /^https:\/\/tiles\.openfreemap\.org\/planet$/,
            new URL('/__status__/503/tile.png', location.href).href,
        );
        const { map } = await renderApp(tiles);
        // OpenFreeMap недоступна — на карте Tracestrack, круг топокарты отмечен, но его цель — OpenFreeMap
        await expect.poll(() => mapLayerIds(map)).toEqual(['Tt']);
        expect(pressed()).toEqual(['true', 'false', 'false']);
        expect(names()).toEqual(['OpenFreeMap Outdoor', 'Google Map', 'ESRI Satellite']);
        await page.getByRole('button', { name: 'OpenFreeMap Outdoor', exact: true }).click();
        // нажатие пробует OpenFreeMap снова; Tracestrack выбором не становится ни в адресе, ни в памяти круга
        await expect.poll(() => location.hash).toContain('l=Of');
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        expect(saved.selection.base).toBe('Of');
        expect(saved.quickLayers?.Of).not.toBe('Tt');
    });

    test('Отмеченный круг не меняет подложку', async () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: 1, listed: {}, custom: [], selection: { base: 'Otm', overlays: [] } }),
        );
        const { map } = await renderApp(tiles);
        await expect.poll(() => mapLayerIds(map)).toEqual(['Otm']);
        expect(pressed()).toEqual(['true', 'false', 'false']);
        await page.getByRole('button', { name: 'OpenTopoMap', exact: true }).click();
        await expect.poll(() => mapLayerIds(map)).toEqual(['Otm']);
        expect(location.hash).toMatch(/l=Otm(&|$)/);
    });
});

describe('Настройка списка слоёв', () => {
    test('Скрыть слой из списка', async () => {
        await renderApp(tiles);
        let menu = await openMenu('Topo layers');
        expect(itemNames(menu)).toContain('CyclOSM');
        await userEvent.keyboard('{Escape}');
        const switcher = await openSwitcher();
        await switcher.getByText('Configure layers').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByText('CyclOSM').click();
        await dialog.getByRole('button', { name: 'Ok' }).click();
        await expect.element(dialog).not.toBeInTheDocument();
        menu = await openMenu('Topo layers');
        expect(itemNames(menu)).toEqual([
            'OpenFreeMap Outdoor',
            'Tracestrack Topo',
            'OpenTopoMap',
            'OSM Outdoors',
            'OpenCycleMap',
        ]);
        await userEvent.keyboard('{Escape}');

        // после перезагрузки — тоже скрыт
        await cleanup();
        await renderApp(tiles);
        menu = await openMenu('Topo layers');
        expect(itemNames(menu)).not.toContain('CyclOSM');
    });
});

describe('Настройка списка слоёв: кнопки столбца', () => {
    test('Кнопок столбца в настройке нет', async () => {
        await renderApp(tiles);
        const switcher = await openSwitcher();
        await switcher.getByText('Configure layers').click();
        const dialog = page.getByRole('dialog');
        await expect.element(dialog.getByRole('checkbox', { name: 'OpenTopoMap' })).toBeChecked();
        await expect.element(dialog.getByRole('checkbox', { name: 'Tracestrack Topo' })).toBeChecked();
        for (const name of [
            'OpenFreeMap Outdoor',
            'Google Map',
            'ESRI Satellite',
            'Strava heatmap (all)',
            'Satellite by date',
        ]) {
            expect(dialog.getByRole('checkbox', { name, exact: true }).elements(), name).toHaveLength(0);
        }
        await expect.element(dialog.getByRole('checkbox', { name: 'Strava heatmap (run)' })).toBeChecked();
    });
});

describe('Свои слои по URL', () => {
    // Проверка CORS идёт настоящим fetch; сервер своего слоя — выдуманный, поэтому ответ подменяется, а всё
    // остальное уходит в настоящий fetch (тайлы MapLibre — на фикстуру через transformRequest)
    function stubTileServer(cors: boolean) {
        const realFetch = window.fetch.bind(window);
        vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input instanceof Request ? input.url : input);
            if (!url.includes('tiles.example.test')) {
                return realFetch(input, init);
            }
            if (!cors && init?.mode === 'cors') {
                throw new TypeError('Failed to fetch');
            }
            return new Response(null, { status: 200 });
        });
    }

    async function fillCustomLayer(url: string) {
        const switcher = await openSwitcher();
        await switcher.getByText('Add custom layer').click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabelText('Tile url template').fill(url);
        await dialog.getByText('Overlay', { exact: true }).click();
        return dialog;
    }

    test('Добавить свой слой', async () => {
        stubTileServer(true);
        const { map } = await renderApp(tiles);
        const dialog = await fillCustomLayer('https://tiles.example.test/{z}/{x}/{y}.png');
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect.element(dialog).not.toBeInTheDocument();
        await expect.poll(() => mapLayerIds(map).length).toBe(2);
        await expect
            .poll(() => tiles.requested.some((url) => url.startsWith('https://tiles.example.test/')))
            .toBe(true);
        expect(location.hash).toMatch(/l=Of\/-cs[A-Za-z0-9_=-]+/);
        const switcher = await openSwitcher();
        await expect.element(switcher.getByRole('checkbox', { name: /Custom layer/ })).toBeChecked();
    });

    test('Сервер без CORS', async () => {
        stubTileServer(false);
        await renderApp(tiles);
        const dialog = await fillCustomLayer('https://tiles.example.test/{z}/{x}/{y}.png');
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect
            .element(dialog.getByRole('alert'))
            .toHaveTextContent(
                'The tile server does not allow loading its tiles on other sites (no CORS). Use proxy to load them.',
            );
        await expect.element(dialog.getByText('Use proxy')).toBeVisible();
    });

    test('Неподдерживаемый шаблон', async () => {
        await renderApp(tiles);
        const dialog = await fillCustomLayer('https://tiles.example.test/z{z_1}/{x_1024}/x{x}/{y_1024}/y{y}.png');
        await dialog.getByRole('button', { name: 'Add layer' }).click();
        await expect
            .element(dialog.getByRole('alert'))
            .toHaveTextContent('Variables {z_1}, {x_1024}, {y_1024} are not supported');
    });
});
