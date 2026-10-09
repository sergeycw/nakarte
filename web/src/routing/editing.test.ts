import { describe, expect, test } from 'vitest';
import { buildCatalog } from '@/layers/catalog';
import { EMPTY_SETTINGS } from '@/layers/settings';
import { createAppStore } from '@/state/store';
import { memoryStorage } from '@/test/memory-storage';
import { createTrackActions } from '@/tracks/actions';
import { geoData, type LatLng } from '@/tracks/model';
import { RoutingError } from './brouter';
import { createRouteEditing } from './editing';
import { fromSegment } from './line';
import type { Router } from './router';

// Сценарии спек route-editing, routing и tracks на связи редактора со стором: стор настоящий, роутер поддельный
// (тест сам отвечает на каждый запрос), карты нет.

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const P = (lat: number, lng: number) => ({ lat, lng });
const A = P(41.69, 44.78);
const B = P(41.7, 44.79);
const C = P(41.71, 44.8);

interface Call {
    from: LatLng;
    to: LatLng;
    resolve(points: LatLng[]): void;
    reject(error: Error): void;
}

function setup(activity: string | null = 'hiking') {
    const store = createAppStore({
        catalog: buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' }),
        corsProxyUrl: 'https://proxy.test/',
        settings: EMPTY_SETTINGS,
        selection: { base: 'O', overlays: [] },
        view: { lat: 0, lng: 0, zoom: 1 },
        routingActivity: activity,
    });
    const calls: Call[] = [];
    let warmUps = 0;
    const router: Router = {
        route: (from, to, _activity, signal) =>
            new Promise((resolve, reject) => {
                calls.push({ from, to, resolve, reject });
                signal?.addEventListener('abort', () => reject(signal.reason));
            }),
        warmUp: () => {
            warmUps += 1;
        },
        isReachable: async () => true,
        status: () => 'ready',
        subscribe: () => () => {},
    };
    const messages: string[] = [];
    const storage = memoryStorage();
    const editing = createRouteEditing({
        store,
        router,
        engine: 'server',
        notify: (title) => messages.push(title),
        storage,
    });
    const actions = createTrackActions({
        store,
        sources: { fetch: globalThis.fetch, corsProxyUrl: '', tracksStorageServer: '' },
        notify: () => {},
        location: () => ({ origin: '', pathname: '', hash: '' }),
    });
    return { store, editing, actions, calls, messages, storage, warmUps: () => warmUps };
}

const tracks = (ctx: ReturnType<typeof setup>) => ctx.store.getState().tracks;
const edit = (ctx: ReturnType<typeof setup>) => ctx.store.getState().routeEdit;

describe('Действия со списком', () => {
    test('Новый трек', async () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        expect(edit(ctx)?.drawing).toBe('end');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.calls[0].resolve([P(41.695, 44.785)]);
        await flush();
        ctx.editing.stopDrawing();
        ctx.editing.stop();
        expect(tracks(ctx)).toHaveLength(1);
        expect(tracks(ctx)[0].name).toBe('New track');
        expect(tracks(ctx)[0].segments).toEqual([[A, P(41.695, 44.785), B]]);
        expect(edit(ctx)).toBeNull();
    });

    test('название из поля ввода', () => {
        const ctx = setup();
        ctx.editing.newTrack('Kazbegi');
        expect(tracks(ctx)[0].name).toBe('Kazbegi');
    });
});

describe('Начало и конец редактирования', () => {
    test('Пустой новый трек', () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        // Escape дважды: конец рисования, конец редактирования
        ctx.editing.stopDrawing();
        expect(edit(ctx)).not.toBeNull();
        ctx.editing.stop();
        expect(tracks(ctx)).toEqual([]);
    });

    test('отрезок меньше двух точек удаляется, трек с другими отрезками остаётся', () => {
        const ctx = setup();
        const [track] = ctx.store.getState().addTracks([geoData('Two', { segments: [[A, B]] })]);
        ctx.editing.addSegment(track.id);
        ctx.editing.click(C);
        ctx.editing.stop();
        expect(tracks(ctx)[0].segments).toEqual([[A, B]]);
    });

    test('трек скрыли во время редактирования — редактирование заканчивается', () => {
        const ctx = setup();
        const [track] = ctx.store.getState().addTracks([geoData('Two', { segments: [[A, B]] })]);
        ctx.editing.start(track.id, 0);
        ctx.store.getState().updateTrack(track.id, { visible: false });
        expect(edit(ctx)).toBeNull();
    });
});

describe('Действия с треком', () => {
    test('Добавить отрезок', async () => {
        const ctx = setup(null);
        const [track] = ctx.store.getState().addTracks([geoData('One', { segments: [[A, B]] })]);
        ctx.editing.addSegment(track.id);
        expect(edit(ctx)).toMatchObject({ segment: 1, drawing: 'end' });
        ctx.editing.click(C);
        ctx.editing.click(P(41.72, 44.81));
        ctx.editing.stop();
        expect(tracks(ctx)[0].segments).toHaveLength(2);
    });

    test('Развернуть проложенный трек', async () => {
        const ctx = setup('road-bike');
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.calls[0].resolve([P(41.695, 44.785)]);
        await flush();
        ctx.editing.stop();
        ctx.actions.reverse(tracks(ctx)[0]);
        ctx.editing.start(tracks(ctx)[0].id, 0);
        // после разворота опорные точки — B и A, перетаскивание A перестраивает B–A как «Road bike»
        expect(edit(ctx)?.line.waypoints).toEqual([B, A]);
        ctx.editing.moveWaypoint(1, P(41.689, 44.779));
        expect(edit(ctx)?.line.legs[0]).toMatchObject({ state: 'pending', activity: 'road-bike' });
    });
});

describe('История переживает выход из редактирования', () => {
    test('Повторный вход', () => {
        const ctx = setup(null);
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.editing.click(C);
        ctx.editing.stop();
        ctx.editing.start(tracks(ctx)[0].id, 0);
        expect(edit(ctx)?.canUndo).toBe(true);
        ctx.editing.undo();
        expect(tracks(ctx)[0].segments[0]).toEqual([A, B]);
    });

    test('Линию изменили снаружи', () => {
        const ctx = setup(null);
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.editing.stop();
        ctx.actions.reverse(tracks(ctx)[0]);
        ctx.editing.start(tracks(ctx)[0].id, 0);
        expect(edit(ctx)?.canUndo).toBe(false);
    });

    test('маршрут, пришедший после выхода, внешним изменением не считается', async () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.editing.stop();
        ctx.calls[0].resolve([P(41.695, 44.785)]);
        await flush();
        expect(tracks(ctx)[0].segments[0]).toEqual([A, P(41.695, 44.785), B]);
        ctx.editing.start(tracks(ctx)[0].id, 0);
        expect(edit(ctx)?.canUndo).toBe(true);
        expect(fromSegment(tracks(ctx)[0].segments[0], tracks(ctx)[0].routes?.[0]).legs[0].state).toBe('routed');
    });

    test('трек удалили — запросы его редактора отменены, ответ ничего не пишет', async () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.store.getState().removeTracks([tracks(ctx)[0].id]);
        expect(edit(ctx)).toBeNull();
        ctx.calls[0].resolve([P(41.695, 44.785)]);
        await flush();
        expect(tracks(ctx)).toEqual([]);
    });
});

describe('Недоступный роутер', () => {
    test('Сервер остановлен во время работы', async () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.editing.click(C);
        for (const call of ctx.calls) {
            call.reject(new RoutingError('BRouter is not reachable', true));
        }
        await flush();
        // оба отрезка прямые и помечены, предупреждение одно, кнопка красная
        expect(edit(ctx)?.line.legs.map((leg) => leg.state)).toEqual(['failed', 'failed']);
        expect(ctx.messages).toEqual([
            'BRouter is not running, start it with yarn local. Lines stay straight until then.',
        ]);
        expect(ctx.store.getState().routerReachable).toBe(false);
    });

    test('Роутер снова доступен', async () => {
        const ctx = setup();
        ctx.store.getState().setRouterReachable(false);
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.calls[0].resolve([]);
        await flush();
        expect(ctx.store.getState().routerReachable).toBe(true);
    });

    test('Нет маршрута: уведомление с причиной', async () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        ctx.calls[0].reject(new RoutingError('datafile E30_N55.rd5 not found'));
        await flush();
        expect(ctx.messages).toEqual(['Routing failed: no routing data for this area']);
        expect(tracks(ctx)[0].segments[0]).toEqual([A, B]);
    });
});

describe('Выбор активности', () => {
    test('выбор сохраняется и прогревает движок, «Off» — нет', () => {
        const ctx = setup(null);
        ctx.editing.setActivity('gravel');
        expect(ctx.store.getState().routingActivity).toBe('gravel');
        expect(ctx.storage.getItem('nakarte-web:routing-activity')).toBe('gravel');
        expect(ctx.warmUps()).toBe(1);
        ctx.editing.setActivity(null);
        expect(ctx.storage.getItem('nakarte-web:routing-activity')).toBeNull();
        expect(ctx.warmUps()).toBe(1);
    });

    test('Прокладка выключена: новые отрезки прямые', () => {
        const ctx = setup(null);
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B);
        expect(ctx.calls).toHaveLength(0);
        expect(edit(ctx)?.line.legs).toEqual([{ state: 'straight' }]);
    });

    test('Alt-клик', () => {
        const ctx = setup();
        ctx.editing.newTrack('');
        ctx.editing.click(A);
        ctx.editing.click(B, true);
        expect(ctx.calls).toHaveLength(0);
    });
});
