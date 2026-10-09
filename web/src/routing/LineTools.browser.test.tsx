import type { LineString } from 'geojson';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { bend, type FakeRouter, fakeRouter } from '@/test/fake-router';
import {
    chooseFromMenu,
    click,
    drag,
    editPanel,
    features,
    fire,
    idle,
    key,
    legs,
    longPress,
    mapMenu,
    menuItems,
    near,
    newTrack,
    P,
    pressEscape,
    rightClick,
    tap,
    waypoints,
} from '@/test/map-events';
import { memoryAutosave } from '@/test/memory-autosave';
import { renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import type { LatLng } from '@/tracks/model';
import { saveNktk } from '@/tracks/nktk';
import { TRACK_LINES } from '@/tracks/style';
import { EDIT_PREVIEW } from './edit-style';

// Меню опорной точки и линии, Cut, Join, Shortcut в App на настоящей карте MapLibre: тайлы — фикстура, роутер —
// поддельный (маршрут — излом посередине, bend). Мышь и пальцы — синтетические события на холсте по map.project.
// Названия тестов — сценарии спеки route-editing (design add-web-line-tools).

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
});

afterEach(async () => {
    await cleanup();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

// Тбилиси, зум старого клиента 15: между точками ≈ 100 px
const VIEW = '#m=15/41.69/44.785';
const A = P(41.687, 44.78);
const B = P(41.69, 44.785);
const C = P(41.693, 44.79);
// зигзаг: ломаная из ссылки упрощается, и точка на прямой между соседями пропала бы
const Z = [P(41.686, 44.776), P(41.689, 44.779), P(41.686, 44.782), P(41.689, 44.785), P(41.686, 44.788)];
const OTHER = [P(41.694, 44.775), P(41.696, 44.779), P(41.694, 44.783)];

const SEGMENT_MENU = ['Delete segment', 'New track from segment'];

function link(name: string, segments: LatLng[][]) {
    return saveNktk({ name, segments, points: [] });
}

async function render(hash = VIEW, router: FakeRouter = fakeRouter({ auto: true }), options = {}) {
    localStorage.setItem('nakarte-web:routing-activity', 'hiking');
    const app = await renderApp(tiles, hash, { router, ...options });
    return { ...app, router };
}

function rows() {
    return page.getByRole('list', { name: 'Tracks' }).getByRole('listitem');
}

const unrouted = (map: MaplibreMap) => legs(map).map((leg) => leg.properties?.unrouted);
// номера отрезков треков вне редактирования (в слое треков редактируемого отрезка нет)
const segmentsOnMap = (map: MaplibreMap) =>
    [
        ...new Set(features<LineString>(map, TRACK_LINES).map((f) => `${f.properties?.id}:${f.properties?.segment}`)),
    ].sort();

// трек A–B–C с двумя проложенными отрезками «Hiking», редактирование продолжается, рисование закончено
async function drawABC(map: MaplibreMap) {
    await newTrack(map, [A, B, C]);
    await expect.poll(() => unrouted(map)).toEqual([false, false]);
    pressEscape();
    await expect.element(page.getByText('Drag points, click line end to continue')).toBeVisible();
}

async function lengthText() {
    return (await page.getByTestId('track-length').first().element().textContent) ?? '';
}

describe('Меню опорной точки и линии', () => {
    test('Меню средней точки', async () => {
        const { map } = await render();
        await drawABC(map);
        await rightClick(map, B);
        expect(await menuItems()).toEqual(['Cut', 'Reverse', 'Shortcut', 'Delete point', ...SEGMENT_MENU]);
    });

    test('Меню крайней точки', async () => {
        const { map } = await render();
        await drawABC(map);
        await rightClick(map, C);
        const items = await menuItems();
        expect(items).toContain('Join');
        expect(items).not.toContain('Cut');
    });

    test('Меню линии вне редактирования', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Zigzag', [Z])}`);
        await expect.poll(() => segmentsOnMap(map)).toHaveLength(1);
        await rightClick(map, P((Z[0].lat + Z[1].lat) / 2, (Z[0].lng + Z[1].lng) / 2));
        await expect.element(editPanel()).toBeVisible();
        expect(await menuItems()).toEqual(['Cut', 'Reverse', 'Shortcut', ...SEGMENT_MENU]);
    });

    test('правый клик мимо линий меню не открывает', async () => {
        const { map } = await render();
        await drawABC(map);
        await rightClick(map, P(41.684, 44.79));
        await new Promise((resolve) => setTimeout(resolve, 100));
        await expect.element(mapMenu()).not.toBeInTheDocument();
    });

    test('Долгое нажатие', async () => {
        const { map } = await render();
        await drawABC(map);
        await longPress(map, B);
        expect(await menuItems()).toContain('Delete point');
        expect(near(waypoints(map)[1], B)).toBe(true);
    });

    test('долгое нажатие на линии — меню линии, точка не вставляется; тап по линии — вставка', async () => {
        const { map } = await render();
        await drawABC(map);
        const [corner] = bend(A, B);
        await longPress(map, corner);
        expect(await menuItems()).toEqual(['Cut', 'Reverse', 'Shortcut', ...SEGMENT_MENU]);
        expect(waypoints(map)).toHaveLength(3);
        // Escape в меню закрывает только меню: фокус в нём, клавиши редактора там не действуют
        await userEvent.keyboard('{Escape}');
        await expect.element(mapMenu()).not.toBeInTheDocument();
        await expect.element(editPanel()).toBeVisible();
        await tap(map, corner);
        await expect.poll(() => waypoints(map)).toHaveLength(4);
    });
});

describe('Удаление опорной точки из меню', () => {
    test('Удалить точку из меню', async () => {
        const { map, router } = await render();
        await drawABC(map);
        await rightClick(map, B);
        await chooseFromMenu('Delete point');
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        // A–C прокладывается с активностью соседнего отрезка
        expect(router.calls.at(-1)?.activity.id).toBe('hiking');
        expect(near(router.calls.at(-1)?.from as LatLng, A) && near(router.calls.at(-1)?.to as LatLng, C)).toBe(true);
        key({ key: 'z', code: 'KeyZ', metaKey: true });
        await expect.poll(() => waypoints(map)).toHaveLength(3);
    });
});

describe('Разрез отрезка', () => {
    test('Разрез в опорной точке', async () => {
        const { map } = await render();
        await drawABC(map);
        await rightClick(map, B);
        await chooseFromMenu('Cut');
        // редактируется первая половина A–B, проложенная
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        expect(near(waypoints(map)[1], B)).toBe(true);
        expect(unrouted(map)).toEqual([false]);
        await expect.element(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
        await page.getByRole('button', { name: 'Done' }).click();
        await expect.poll(() => segmentsOnMap(map)).toHaveLength(2);
    });

    test('Разрез посреди маршрута', async () => {
        const { map } = await render();
        await drawABC(map);
        const before = await lengthText();
        const [corner] = bend(A, B);
        await rightClick(map, corner);
        await chooseFromMenu('Cut');
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        expect(near(waypoints(map)[0], A)).toBe(true);
        expect(unrouted(map)).toEqual([false]);
        expect(await lengthText()).toBe(before);
    });
});

describe('Склейка отрезков', () => {
    test('Склеить с отрезком другого трека', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Zigzag', [Z])}/${link('Other', [OTHER])}`);
        await expect.element(rows()).toHaveLength(2);
        await click(map, Z[4]);
        await expect.element(editPanel()).toBeVisible();
        await rightClick(map, Z[4]);
        await chooseFromMenu('Join');
        await expect.element(page.getByText('Click a track line to join it')).toBeVisible();
        // курсор над линией Other ближе к её концу: линия выбора зелёная и прилипает к концу
        const nearEnd = P((OTHER[1].lat + OTHER[2].lat) / 2, (OTHER[1].lng + OTHER[2].lng) / 2);
        fire(map, 'mousemove', nearEnd);
        await expect
            .poll(() => features<LineString>(map, EDIT_PREVIEW).map((f) => f.properties?.color))
            .toEqual(['#16a34a']);
        await click(map, nearEnd);
        await expect.poll(() => waypoints(map)).toHaveLength(8);
        expect(near(waypoints(map)[5], OTHER[2])).toBe(true);
        expect(near(waypoints(map)[7], OTHER[0])).toBe(true);
        await expect.element(rows()).toHaveLength(2);
        await expect.element(page.getByText('Drag points, click line end to continue')).toBeVisible();
    });

    test('Склеить отрезки одного трека', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Two', [Z, OTHER])}`);
        await expect.poll(() => segmentsOnMap(map)).toHaveLength(2);
        await click(map, Z[0]);
        await rightClick(map, Z[0]);
        await chooseFromMenu('Join');
        await click(map, OTHER[0]);
        await expect.poll(() => waypoints(map)).toHaveLength(8);
        await page.getByRole('button', { name: 'Done' }).click();
        await expect.poll(() => segmentsOnMap(map)).toHaveLength(1);
    });

    test('Отмена выбора', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Zigzag', [Z])}/${link('Other', [OTHER])}`);
        await click(map, Z[4]);
        await rightClick(map, Z[4]);
        await chooseFromMenu('Join');
        fire(map, 'mousemove', P(41.684, 44.79));
        await expect.poll(() => features<LineString>(map, EDIT_PREVIEW)).toHaveLength(1);
        pressEscape();
        await expect.element(page.getByRole('button', { name: 'Done' })).toBeVisible();
        expect(features<LineString>(map, EDIT_PREVIEW)).toHaveLength(0);
        // клик по другой линии теперь начинает её редактирование, а не склейку
        await click(map, OTHER[1]);
        await expect.poll(() => waypoints(map)).toHaveLength(3);
    });
});

describe('Срез участка', () => {
    test('Срезать петлю', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Zigzag', [Z])}`);
        await click(map, Z[1]);
        await rightClick(map, Z[1]);
        await chooseFromMenu('Shortcut');
        await expect.element(page.getByText('Click the line where the shortcut ends')).toBeVisible();
        // подсветка: удаляемый участок красный, линия выбора зелёная
        fire(map, 'mousemove', Z[3]);
        await expect
            .poll(() => features<LineString>(map, EDIT_PREVIEW).map((f) => f.properties?.color))
            .toEqual(['#e11d48', '#16a34a']);
        await click(map, Z[3]);
        await expect.poll(() => waypoints(map)).toHaveLength(4);
        expect(near(waypoints(map)[1], Z[1]) && near(waypoints(map)[2], Z[3])).toBe(true);
        key({ key: 'z', code: 'KeyZ', metaKey: true });
        await expect.poll(() => waypoints(map)).toHaveLength(5);
    });

    test('Срез из середины маршрута', async () => {
        const { map } = await render();
        await drawABC(map);
        const [corner] = bend(A, B);
        await rightClick(map, corner);
        await chooseFromMenu('Shortcut');
        await click(map, C);
        await expect.poll(() => waypoints(map)).toHaveLength(3);
        // A — до точки начала проложен, от неё до C — прямая
        expect(unrouted(map)).toEqual([false, false]);
        expect(near(waypoints(map)[1], corner)).toBe(true);
    });

    test('клик, после которого удалять нечего, выбор не заканчивает; клик мимо — отмена', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Zigzag', [Z])}`);
        await click(map, Z[1]);
        await rightClick(map, Z[1]);
        await chooseFromMenu('Shortcut');
        await click(map, Z[2]);
        expect(waypoints(map)).toHaveLength(5);
        await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await click(map, P(41.694, 44.79));
        await expect.element(page.getByRole('button', { name: 'Done' })).toBeVisible();
        expect(waypoints(map)).toHaveLength(5);
    });
});

describe('Разворот отрезка', () => {
    test('Развернуть отрезок', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Two', [Z, OTHER])}`);
        await click(map, Z[1]);
        await rightClick(map, Z[1]);
        await chooseFromMenu('Reverse');
        await expect.poll(() => near(waypoints(map)[0], Z[4])).toBe(true);
        await expect.element(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
        await page.getByRole('button', { name: 'Done' }).click();
        await click(map, OTHER[1]);
        expect(near(waypoints(map)[0], OTHER[0])).toBe(true);
    });

    test('проложенный отрезок остаётся проложенным', async () => {
        const { map } = await render();
        await drawABC(map);
        await rightClick(map, B);
        await chooseFromMenu('Reverse');
        await expect.poll(() => near(waypoints(map)[0], C)).toBe(true);
        expect(unrouted(map)).toEqual([false, false]);
    });
});

describe('Удаление и вынос отрезка', () => {
    test('Удалить отрезок', async () => {
        const { map } = await render(`${VIEW}&nktk=${link('Two', [Z, OTHER])}`);
        await click(map, Z[1]);
        await rightClick(map, Z[1]);
        await chooseFromMenu('Delete segment');
        await expect.element(editPanel()).not.toBeInTheDocument();
        await expect.poll(() => segmentsOnMap(map)).toHaveLength(1);
        await expect.element(rows()).toHaveLength(1);
    });

    test('Новый трек из отрезка', async () => {
        const { map, router } = await render();
        await drawABC(map);
        await rightClick(map, B);
        await chooseFromMenu('New track from segment');
        await expect.element(rows()).toHaveLength(2);
        await expect.element(rows().nth(1)).toHaveAttribute('data-track', 'New track');
        await expect.element(editPanel()).toBeVisible();
        await page.getByRole('button', { name: 'Done' }).click();
        // исходный трек удалён, прокладка выключена: перетаскивание опорной точки копии перестраивает её отрезок
        // своей активностью, значит, разметка скопирована
        await page.getByRole('button', { name: 'Actions for New track' }).first().click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await expect.element(rows()).toHaveLength(1);
        await page.getByRole('button', { name: /^Routing/ }).click();
        await page.getByRole('menuitemradio', { name: 'Off: straight lines' }).click();
        const calls = router.calls.length;
        await click(map, A);
        await expect.poll(() => waypoints(map)).toHaveLength(3);
        expect(unrouted(map)).toEqual([false, false]);
        await drag(map, A, P(41.6865, 44.779));
        await expect.poll(() => router.calls.length).toBe(calls + 1);
        expect(router.calls.at(-1)?.activity.id).toBe('hiking');
    });
});

describe('Разметка маршрута после правки линии', () => {
    test('Перезагрузка после разреза', async () => {
        const autosave = memoryAutosave();
        const first = await render(VIEW, fakeRouter({ auto: true }), { autosave });
        await drawABC(first.map);
        await rightClick(first.map, B);
        await chooseFromMenu('Cut');
        await expect.poll(() => waypoints(first.map)).toHaveLength(2);
        await cleanup();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const { map } = await render(VIEW, fakeRouter({ auto: true }), { autosave });
        await expect.poll(() => segmentsOnMap(map)).toHaveLength(2);
        for (const corner of [bend(A, B)[0], bend(B, C)[0]]) {
            await click(map, corner);
            await expect.poll(() => waypoints(map)).toHaveLength(2);
            expect(unrouted(map)).toEqual([false]);
            pressEscape();
            await expect.element(editPanel()).not.toBeInTheDocument();
        }
    });

    test('Отрезок, ждавший маршрута, после разреза — непроложенный', async () => {
        const router = fakeRouter();
        const { map } = await render(VIEW, router);
        await newTrack(map, [A, B, C]);
        pressEscape();
        await rightClick(map, B);
        await chooseFromMenu('Cut');
        await expect.poll(() => unrouted(map)).toEqual([true]);
        expect(router.live()).toHaveLength(0);
        await idle(map);
    });
});
