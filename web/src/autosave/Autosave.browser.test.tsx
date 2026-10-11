import type { Map as MaplibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import type { SegmentRoute } from '@/routing/line';
import { bend, type FakeRouter, fakeRouter } from '@/test/fake-router';
import {
    click,
    drag,
    editPanel,
    features,
    fire,
    idle,
    key,
    legs,
    near,
    newTrack,
    P,
    pressEscape,
    waypoints,
} from '@/test/map-events';
import { memoryAutosave } from '@/test/memory-autosave';
import { renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import { type LatLng, TRACK_COLORS } from '@/tracks/model';
import { ARC_UNIT, saveNktk } from '@/tracks/nktk';
import { TRACK_LINES } from '@/tracks/style';
import type { AutosaveStorage } from './autosave';
import { indexedDbStorage } from './idb';
import { legacySessionSource } from './legacy-session';

// Автосохранение в App на настоящем IndexedDB Chromium. «Перезагрузка» — размонтировать App (он дописывает
// несохранённое, как на pagehide) и отрендерить заново с новым подключением к той же базе. Настоящая перезагрузка
// страницы — e2e (e2e/autosave.spec.ts). Названия тестов — сценарии спек route-editing и tracks.

let tiles: FixtureTiles;
const databases: string[] = [];

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
});

afterEach(async () => {
    await cleanup();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
    await Promise.all(
        databases.splice(0).map(
            (name) =>
                new Promise<void>((resolve) => {
                    const request = indexedDB.deleteDatabase(name);
                    request.onsuccess = request.onerror = request.onblocked = () => resolve();
                }),
        ),
    );
});

// Тбилиси, зум старого клиента 15: между точками ≈ 100 px
const VIEW = '#m=15/41.69/44.785';
const A = P(41.687, 44.78);
const B = P(41.69, 44.785);
const C = P(41.693, 44.79);
const MOVED = P(41.6915, 44.783);

// IndexedDB под уникальным именем; записи считаются, чтобы «перезагрузка» читала базу после них
function database() {
    const name = `nakarte-web-test-${crypto.randomUUID()}`;
    databases.push(name);
    const pending = new Set<Promise<void>>();
    const open = (): AutosaveStorage => {
        const inner = indexedDbStorage(name);
        return {
            load: () => inner.load(),
            save: (record) => {
                const saved = inner.save(record);
                const settled = saved.catch(() => {});
                pending.add(settled);
                settled.finally(() => pending.delete(settled));
                return saved;
            },
        };
    };
    return { open, settled: () => Promise.all([...pending]) };
}

type Db = ReturnType<typeof database>;

async function start(db: Db, hash = VIEW, router: FakeRouter = fakeRouter({ auto: true }), activity = 'hiking') {
    localStorage.setItem('nakarte-web:routing-activity', activity);
    const app = await renderApp(tiles, hash, { router, autosave: db.open() });
    return { ...app, router };
}

// Перезагрузка: старый App уходит, его записи доходят до базы, новый App читает её. Активность в меню — другая, чтобы
// было видно, что отрезок перестраивается своей.
async function reload(db: Db, hash = VIEW, router: FakeRouter = fakeRouter({ auto: true })) {
    await cleanup();
    await db.settled();
    return start(db, hash, router, 'mtb');
}

function rows() {
    return page.getByRole('list', { name: 'Tracks' }).getByRole('listitem');
}

async function trackMenu(name: string, item: string) {
    await page.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: item }).click();
}

const lineFeatures = (map: MaplibreMap) => features<GeoJSON.LineString>(map, TRACK_LINES);
const unrouted = (map: MaplibreMap) => legs(map).map((leg) => leg.properties?.unrouted);

// трек A–B–C с двумя проложенными отрезками «Hiking», рисование закончено, редактирование тоже
async function drawABC(map: MaplibreMap) {
    await newTrack(map, [A, B, C]);
    await expect.poll(() => unrouted(map)).toEqual([false, false]);
    pressEscape();
    pressEscape();
    await expect.element(editPanel()).not.toBeInTheDocument();
}

// после перезагрузки: трек на месте, точки маршрута скрыты — вне редактирования это одна линия из всех узлов, при
// редактировании видны только опорные точки и оба отрезка проложены
async function expectRoutedABC(map: MaplibreMap) {
    await expect.element(rows()).toHaveLength(1);
    await expect.poll(() => lineFeatures(map)[0]?.geometry.coordinates.length).toBe(5);
    await click(map, B);
    await expect.element(editPanel()).toBeVisible();
    await expect.poll(() => waypoints(map)).toHaveLength(3);
    expect(unrouted(map)).toEqual([false, false]);
}

describe('Разметка маршрута переживает перезагрузку', () => {
    test('Перезагрузка страницы', async () => {
        const db = database();
        const first = await start(db);
        await drawABC(first.map);
        const { map, router } = await reload(db);
        await expectRoutedABC(map);
        await drag(map, B, MOVED);
        await expect.poll(() => router.calls.length).toBe(2);
        expect(router.calls.map((call) => call.activity.id)).toEqual(['hiking', 'hiking']);
        expect(near(router.calls[0].from, A) && near(router.calls[1].to, C)).toBe(true);
    });

    test('Последний отрезок трека', async () => {
        const db = database();
        const first = await start(db);
        await drawABC(first.map);
        const { map } = await reload(db);
        await expectRoutedABC(map);
        expect(legs(map)).toHaveLength(2);
    });

    test('Конец рисования по Escape', async () => {
        const db = database();
        const first = await start(db);
        await newTrack(first.map, [A, B, C]);
        await expect.poll(() => unrouted(first.map)).toEqual([false, false]);
        // секунда без движения мыши, потом Escape — у старого клиента так пропадала последняя точка
        await new Promise((resolve) => setTimeout(resolve, 1000));
        pressEscape();
        const { map } = await reload(db);
        await expectRoutedABC(map);
        expect(near(waypoints(map)[2], C)).toBe(true);
    });

    test('Трек после undo и redo', async () => {
        const db = database();
        const first = await start(db);
        await newTrack(first.map, [A, B, C]);
        await expect.poll(() => unrouted(first.map)).toEqual([false, false]);
        key({ key: 'z', code: 'KeyZ', metaKey: true });
        await expect.poll(() => waypoints(first.map)).toHaveLength(2);
        key({ key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true });
        await expect.poll(() => waypoints(first.map)).toHaveLength(3);
        pressEscape();
        pressEscape();
        const { map } = await reload(db);
        await expectRoutedABC(map);
    });

    test('Разворот трека', async () => {
        const db = database();
        const first = await start(db);
        await drawABC(first.map);
        await trackMenu('New track', 'Reverse');
        const { map } = await reload(db);
        await expectRoutedABC(map);
        expect(near(waypoints(map)[0], C) && near(waypoints(map)[2], A)).toBe(true);
    });

    test('Опорная точка на прямой', async () => {
        const db = database();
        const first = await start(db);
        await newTrack(first.map, [A, C]);
        await expect.poll(() => unrouted(first.map)).toEqual([false]);
        pressEscape();
        // точка посередине между A и изломом маршрута заглушки: вставка без перетаскивания кладёт её на прямую
        const [corner] = bend(A, C);
        const onLine = P((A.lat + corner.lat) / 2, (A.lng + corner.lng) / 2);
        await idle(first.map);
        fire(first.map, 'mousemove', onLine);
        fire(first.map, 'mousedown', onLine);
        fire(first.map, 'mouseup', onLine);
        fire(first.map, 'click', onLine);
        await expect.poll(() => waypoints(first.map)).toHaveLength(3);
        expect(first.router.calls).toHaveLength(1);
        pressEscape();
        const { map } = await reload(db);
        await expect.element(rows()).toHaveLength(1);
        await click(map, A);
        await expect.poll(() => waypoints(map)).toHaveLength(3);
        expect(near(waypoints(map)[1], onLine)).toBe(true);
        expect(unrouted(map)).toEqual([false, false]);
    });

    test('Перезагрузка во время прокладки', async () => {
        const db = database();
        const first = await start(db, VIEW, fakeRouter());
        await newTrack(first.map, [A, C]);
        await expect.poll(() => first.map.getCanvas().style.cursor).toBe('progress');
        const { map } = await reload(db);
        await expect.element(rows()).toHaveLength(1);
        await click(map, P((A.lat + C.lat) / 2, (A.lng + C.lng) / 2));
        await expect.poll(() => unrouted(map)).toEqual([true]);
    });
});

describe('Разметка маршрута в ссылке, в файлах — только геометрия', () => {
    test('Открытие ссылки', async () => {
        const [corner] = bend(A, C);
        const route: SegmentRoute = { waypoints: [0, 2], legs: [{ state: 'routed', activity: 'hiking' }] };
        const nktk = saveNktk({ name: 'Routed', segments: [[A, corner, C]], points: [], routes: [route] });
        const router = fakeRouter({ auto: true });
        localStorage.setItem('nakarte-web:routing-activity', 'mtb');
        const { map } = await renderApp(tiles, `${VIEW}&nktk=${nktk}`, { router });
        await expect.element(rows()).toHaveLength(1);
        await click(map, A);
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        expect(unrouted(map)).toEqual([false]);
        await drag(map, C, MOVED);
        await expect.poll(() => router.calls.length).toBe(1);
        expect(router.calls[0].activity.id).toBe('hiking');
    });
});

describe('Треки переживают перезагрузку', () => {
    const track = (name: string, points: LatLng[]) => saveNktk({ name, segments: [points], points: [] });
    const TWO = `${VIEW}&nktk=${track('First', [A, B])}/${track('Second', [B, C])}`;

    test('Список после перезагрузки', async () => {
        const db = database();
        await start(db, TWO);
        await expect.element(rows()).toHaveLength(2);
        const lengths = [...document.querySelectorAll('[data-testid="track-length"]')].map((el) => el.textContent);
        await page.getByRole('button', { name: 'Color of Second' }).click();
        await page.getByRole('button', { name: 'Color 4' }).click();
        await page.getByRole('checkbox', { name: 'Show Second' }).click();
        const { map } = await reload(db);
        await expect.element(rows()).toHaveLength(2);
        expect(
            rows()
                .elements()
                .map((row) => row.querySelector('button[aria-label^="Actions for"]')?.ariaLabel),
        ).toEqual(['Actions for First', 'Actions for Second']);
        expect([...document.querySelectorAll('[data-testid="track-length"]')].map((el) => el.textContent)).toEqual(
            lengths,
        );
        await expect.element(page.getByRole('checkbox', { name: 'Show First' })).toBeChecked();
        await expect.element(page.getByRole('checkbox', { name: 'Show Second' })).not.toBeChecked();
        await page.getByRole('checkbox', { name: 'Show Second' }).click();
        await expect
            .poll(() => lineFeatures(map).map((line) => line.properties?.color))
            .toEqual([TRACK_COLORS[0], TRACK_COLORS[3]]);
    });

    test('Удалённый трек', async () => {
        const db = database();
        await start(db, TWO);
        await expect.element(rows()).toHaveLength(2);
        await trackMenu('First', 'Delete');
        await expect.element(rows()).toHaveLength(1);
        await reload(db);
        await expect.element(rows()).toHaveLength(1);
        await expect.element(page.getByRole('button', { name: 'Second' })).toBeVisible();
    });

    test('Хранилище недоступно', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const denied: AutosaveStorage = {
            load: () => Promise.reject(new DOMException('denied', 'SecurityError')),
            save: () => Promise.reject(new DOMException('denied', 'SecurityError')),
        };
        const { map } = await renderApp(tiles, VIEW, { router: fakeRouter({ auto: true }), autosave: denied });
        await newTrack(map, [A, C]);
        pressEscape();
        pressEscape();
        await expect.element(rows()).toHaveLength(1);
        await cleanup();
        await renderApp(tiles, VIEW, { autosave: denied });
        await expect.element(page.getByRole('list', { name: 'Tracks' })).not.toBeInTheDocument();
        vi.restoreAllMocks();
    });
});

// Спека tracks, «Сохранённые сессии старого клиента не трогаются»: база sessions в схеме старого клиента
// (src/lib/session-state на коммите 015be893), разметка — ключи сетки nktk (routeMarkupKey)
describe('Сохранённые сессии старого клиента не трогаются', () => {
    const markupKey = ({ lat, lng }: LatLng) => `${Math.round(lat * ARC_UNIT)},${Math.round(lng * ARC_UNIT)}`;

    function writeLegacySession(name: string, data: unknown) {
        databases.push(name);
        return new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore('sessionData', { keyPath: 'sessionId' });
                store.createIndex('mtime', 'mtime', { unique: false });
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const transaction = request.result.transaction('sessionData', 'readwrite');
                transaction.objectStore('sessionData').put({ sessionId: 'old', mtime: Date.now(), data });
                transaction.oncomplete = () => {
                    request.result.close();
                    resolve();
                };
                transaction.onabort = () => reject(transaction.error);
            };
        });
    }

    test('Сессия старого клиента', async () => {
        const name = `sessions-test-${crypto.randomUUID()}`;
        const [corner] = bend(A, C);
        await writeLegacySession(name, {
            hash: '#',
            tracks: saveNktk({ name: 'Old session', segments: [[A, corner, C]], points: [] }),
            trackNames: ['Old session'],
            routeMarkup: { legs: [[markupKey(A), markupKey(C), 'hiking']] },
        });
        const router = fakeRouter({ auto: true });
        localStorage.setItem('nakarte-web:routing-activity', 'mtb');
        const { map } = await renderApp(tiles, VIEW, {
            router,
            autosave: { ...memoryAutosave(), legacy: legacySessionSource(() => indexedDB, name) },
        });
        await expect.element(rows()).toHaveLength(1);
        await expect.element(page.getByRole('button', { name: 'Old session', exact: true })).toBeVisible();
        // точка маршрута скрыта: опорные — только концы, отрезок проложен активностью сессии, а не выбранной
        await click(map, A);
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        expect(unrouted(map)).toEqual([false]);
        await drag(map, C, MOVED);
        await expect.poll(() => router.calls.length).toBe(1);
        expect(router.calls[0].activity.id).toBe('hiking');
    });
});
