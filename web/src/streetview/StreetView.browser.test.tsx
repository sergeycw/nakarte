import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { fakeRouter } from '@/test/fake-router';
import { type FakeStreetView, fakeStreetView } from '@/test/fake-street-view';
import { click, P, pressEscape, waypoints } from '@/test/map-events';
import { mapLayerIds, renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import { saveNktk } from '@/tracks/nktk';
import { COVERAGE_CODE } from './coverage';

// Street View в App (спека street-view): окно — поддельное (src/test/fake-street-view.ts), покрытие — фикстура тайлов,
// в Google тесты не ходят. Названия тестов — сценарии спеки.

let tiles: FixtureTiles;
let street: FakeStreetView;

// панорамы вдоль улицы у Мтацминды
const ROAD = P(41.693, 44.78);
const VIEW = '#m=15/41.693/44.78&l=O';

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
    street = fakeStreetView([ROAD, P(41.6935, 44.781)]);
});

afterEach(async () => {
    await cleanup();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

async function render(hash = '', options: Parameters<typeof renderApp>[2] = {}) {
    return renderApp(tiles, `${VIEW}${hash}`, {
        router: fakeRouter({ auto: true }),
        streetView: street.api,
        ...options,
    });
}

const button = () => page.getByRole('button', { name: 'Street View', exact: true });
const panel = () => page.getByTestId('street-view-panel');
const marker = () => page.getByTestId('panorama-marker');
const panorama = () => page.getByTestId('fake-panorama');

describe('Режим Street View', () => {
    test('Включить режим', async () => {
        const { map } = await render();
        await button().click();
        await expect.element(button()).toHaveAttribute('aria-pressed', 'true');
        // над подложкой, под треками (слои треков — после него, mapLayerIds их не показывает)
        await expect.poll(() => mapLayerIds(map)).toEqual(['O', COVERAGE_CODE]);
        const ids = map.getStyle().layers.map((layer) => layer.id);
        expect(ids.indexOf(COVERAGE_CODE)).toBeLessThan(ids.indexOf('tracks'));
        await expect.poll(() => tiles.requested.some((url) => url.includes('maps.googleapis.com/maps/vt'))).toBe(true);
        expect(location.hash).toContain('n2=_g');
    });

    test('Выключить режим', async () => {
        const { map } = await render();
        await button().click();
        await click(map, ROAD);
        await expect.element(panel()).toBeVisible();
        await button().click();
        await expect.element(panel()).not.toBeInTheDocument();
        await expect.element(marker()).not.toBeInTheDocument();
        await expect.poll(() => mapLayerIds(map)).toEqual(['O']);
        expect(location.hash).not.toContain('n2=');
        expect(street.destroyed).toBe(1);
    });

    test('Alt+P включает и выключает режим', async () => {
        await render();
        await userEvent.keyboard('{Alt>}p{/Alt}');
        await expect.element(button()).toHaveAttribute('aria-pressed', 'true');
        await userEvent.keyboard('{Alt>}p{/Alt}');
        await expect.element(button()).toHaveAttribute('aria-pressed', 'false');
    });
});

describe('Панорама по клику', () => {
    test('Панорама найдена', async () => {
        const { map } = await render();
        await button().click();
        // клик в паре метров от панорамы
        await click(map, P(41.69302, 44.78002));
        await expect.element(panel()).toBeVisible();
        await expect.element(panorama()).toHaveAttribute('data-view', '41.69300,44.78000,0');
        await expect.element(marker()).toBeVisible();
        // радиус — 24 px экрана: m=15 старого клиента у Тбилиси — ≈ 3.6 м на пиксель, ≈ 85 м
        expect(street.searches[0].radius).toBeGreaterThan(80);
        expect(street.searches[0].radius).toBeLessThan(90);
        await expect.poll(() => location.hash).toContain('n2=_g/g/41.693000/44.780000/0.0/0.0/1.0');
    });

    test('Панорамы рядом нет', async () => {
        const { map } = await render();
        await button().click();
        await click(map, P(41.6915, 44.776));
        await expect.poll(() => street.searches).toHaveLength(1);
        expect(street.viewers).toBe(0);
        await expect.element(panel()).not.toBeVisible();
    });

    test('Рисование линии в режиме Street View', async () => {
        const { map } = await render();
        await button().click();
        await page.getByRole('button', { name: 'New track' }).first().click();
        await click(map, ROAD);
        await click(map, P(41.692, 44.779));
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        expect(street.searches).toEqual([]);
        await expect.element(panel()).not.toBeVisible();
        pressEscape();
    });

    test('без режима клик панораму не ищет', async () => {
        const { map } = await render();
        await click(map, ROAD);
        expect(street.searches).toEqual([]);
    });
});

describe('Панель панорамы', () => {
    test('Направление взгляда', async () => {
        const { map } = await render();
        await button().click();
        await click(map, ROAD);
        await expect.element(panorama()).toBeVisible();
        street.turn(90);
        await expect.element(marker()).toHaveAttribute('data-heading', '90');
        await expect.poll(() => location.hash).toContain('n2=_g/g/41.693000/44.780000/90.0/0.0/1.0');
    });

    test('переход в окне сдвигает метку, уход за край — карту', async () => {
        const { map } = await render();
        await button().click();
        await click(map, ROAD);
        await expect.element(panorama()).toBeVisible();
        street.walk(P(41.6935, 44.781));
        await expect.poll(() => panorama().element().dataset.view).toBe('41.69350,44.78100,0');
        const far = P(41.75, 44.9);
        street.walk(far);
        await expect
            .poll(
                () => Math.abs(map.getCenter().lat - far.lat) < 1e-3 && Math.abs(map.getCenter().lng - far.lng) < 1e-3,
                {
                    timeout: 5000,
                },
            )
            .toBe(true);
    });

    test('Панорама и профиль высот', async () => {
        const line = [P(41.69, 44.776), P(41.692, 44.784)];
        const nktk = saveNktk({ name: 'Walk', segments: [line], points: [] });
        const fetchFn: typeof fetch = async (_input, init) => {
            const rows = String(init?.body).split('\n');
            return new Response(rows.map(() => '500').join('\n'));
        };
        const { map } = await render(`&nktk=${nktk}`, { fetch: fetchFn });
        await page.getByRole('button', { name: 'Actions for Walk' }).click();
        await page.getByRole('menuitem', { name: 'Show elevation profile' }).click();
        const profile = page.getByTestId('elevation-profile');
        await expect.element(profile).toBeVisible();
        await button().click();
        await click(map, ROAD);
        await expect.element(panel()).toBeVisible();
        const svRect = panel().element().getBoundingClientRect();
        const profileRect = profile.element().getBoundingClientRect();
        expect(svRect.bottom).toBeLessThanOrEqual(profileRect.top);
        // карта над обеими панелями: атрибуция и список треков учитывают --bottom-inset
        const inset = getComputedStyle(document.documentElement).getPropertyValue('--bottom-inset');
        expect(inset).toContain('12rem');
        // клик по треку в режиме начинает правку — панель редактора над панорамой
        await click(map, P(41.691, 44.78));
        await expect.element(page.getByTestId('edit-panel')).toBeVisible();
        expect(page.getByTestId('edit-panel').element().getBoundingClientRect().bottom).toBeLessThanOrEqual(svRect.top);
    });

    test('Закрыть панораму', async () => {
        const { map } = await render();
        await button().click();
        await click(map, ROAD);
        await expect.element(panel()).toBeVisible();
        await page.getByRole('button', { name: 'Close Street View' }).click();
        await expect.element(panel()).not.toBeVisible();
        await expect.element(marker()).not.toBeInTheDocument();
        await expect.element(button()).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => location.hash).toMatch(/n2=_g($|&)/u);
        // следующий клик снова ищет и открывает в том же окне
        await click(map, P(41.6935, 44.781));
        await expect.element(panel()).toBeVisible();
        expect(street.viewers).toBe(1);
    });
});

describe('Street View в адресе', () => {
    test('Ссылка с панорамой', async () => {
        await render('&n2=_g/g/41.693000/44.780000/90.0/0.0/1.0');
        await expect.element(button()).toHaveAttribute('aria-pressed', 'true');
        await expect.element(panorama()).toHaveAttribute('data-view', '41.69300,44.78000,90');
        await expect.element(marker()).toHaveAttribute('data-heading', '90');
    });

    test('Старая ссылка n=', async () => {
        await render('&n=41.693000/44.780000/90.0/0.0/1.0');
        await expect.element(panorama()).toHaveAttribute('data-view', '41.69300,44.78000,90');
        expect(location.hash).not.toMatch(/(^|[#&])n=/u);
        expect(location.hash).toContain('n2=_g/g/41.693000/44.780000/90.0/0.0/1.0');
    });

    test('Удалённый провайдер', async () => {
        const { map } = await render('&n2=_w');
        await expect.element(button()).toHaveAttribute('aria-pressed', 'false');
        expect(mapLayerIds(map)).toEqual(['O']);
    });
});

describe('Maps JavaScript API по требованию', () => {
    test('Режим без панорамы', async () => {
        await render();
        await button().click();
        await expect.poll(() => tiles.requested.some((url) => url.includes('maps/vt'))).toBe(true);
        expect(street.searches).toEqual([]);
        expect(street.viewers).toBe(0);
    });

    test('API не загрузился', async () => {
        const { map } = await render();
        street.fail();
        await button().click();
        await click(map, ROAD);
        await expect.element(page.getByText('Street View is unavailable')).toBeVisible();
        await expect.element(panel()).not.toBeVisible();
    });
});
