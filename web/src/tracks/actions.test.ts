import { describe, expect, test } from 'vitest';
import { buildCatalog } from '@/layers/catalog';
import { EMPTY_SETTINGS } from '@/layers/settings';
import { createAppStore } from '@/state/store';
import { createTrackActions, nextPointName, pointCoordinates } from './actions';
import { geoData, type Waypoint } from './model';

// Точки трека на действиях списка без карты (спека tracks, «Добавление точек трека», «Меню точки трека»)

function setup(writeClipboard: (text: Promise<string>) => Promise<void> = async () => {}) {
    const store = createAppStore({
        catalog: buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' }),
        corsProxyUrl: 'https://proxy.test/',
        settings: EMPTY_SETTINGS,
        selection: { base: 'O', overlays: [] },
        view: { lat: 0, lng: 0, zoom: 1 },
    });
    const messages: string[] = [];
    const actions = createTrackActions({
        store,
        sources: { fetch: globalThis.fetch, corsProxyUrl: '', tracksStorageServer: '' },
        notify: (title) => messages.push(title),
        location: () => ({ origin: '', pathname: '', hash: '' }),
        writeClipboard,
    });
    const [track] = store.getState().addTracks([geoData('Walk', { hidden: true })]);
    const points = () => store.getState().tracks[0].points;
    return { store, actions, track, points, messages };
}

const named = (...names: string[]): Waypoint[] => names.map((name) => ({ lat: 0, lng: 0, name }));

describe('nextPointName', () => {
    test('Номер после наибольшего', () => {
        expect(nextPointName(named('003', 'Spring'))).toBe('004');
        expect(nextPointName(named('005', '002'))).toBe('006');
    });

    test('первый номер, номер с суффиксом, не номер', () => {
        expect(nextPointName([])).toBe('001');
        expect(nextPointName(named('007 camp'))).toBe('008');
        expect(nextPointName(named('1234', '12.5', '42'))).toBe('001');
    });

    test('после 999 — пустое', () => {
        expect(nextPointName(named('999'))).toBe('');
    });
});

describe('Добавление точек трека', () => {
    test('Поставить две точки: номера по порядку, трек становится видимым, окно названия открыто', () => {
        const { store, actions, track, points } = setup();
        actions.startAddPoint(track);
        expect(store.getState().tracks[0].visible).toBe(true);
        expect(store.getState().pointTool).toEqual({ kind: 'add', trackId: track.id });
        const first = actions.addPoint(track.id, { lat: 41.69, lng: 44.78 });
        expect(store.getState().pointDialog).toEqual({ trackId: track.id, point: first });
        actions.addPoint(track.id, { lat: 41.7, lng: 404.79 });
        // долгота приводится в ±180, как latlng.wrap() старого клиента
        expect(points()).toEqual([
            { lat: 41.69, lng: 44.78, name: '001' },
            { lat: 41.7, lng: expect.closeTo(44.79), name: '002' },
        ]);
        actions.stopPointTool();
        expect(store.getState().pointTool).toBeNull();
    });
});

describe('Меню точки трека', () => {
    test('Переименовать точку, пустое название допустимо', () => {
        const { actions, track, points } = setup();
        const point = actions.addPoint(track.id, { lat: 41.69, lng: 44.78 }) as Waypoint;
        actions.renamePoint(track.id, point, 'Pass');
        expect(points()[0].name).toBe('Pass');
        actions.renamePoint(track.id, points()[0], '');
        expect(points()[0].name).toBe('');
    });

    test('Переместить точку: режим заканчивается', () => {
        const { store, actions, track, points } = setup();
        const point = actions.addPoint(track.id, { lat: 41.69, lng: 44.78 }) as Waypoint;
        actions.startMovePoint(track.id, point);
        actions.movePoint(track.id, point, { lat: 41.7, lng: 44.8 });
        expect(points()).toEqual([{ lat: 41.7, lng: 44.8, name: '001' }]);
        expect(store.getState().pointTool).toBeNull();
    });

    test('Удалить точку; пропавшая точка — ничего', () => {
        const { actions, track, points } = setup();
        const first = actions.addPoint(track.id, { lat: 41.69, lng: 44.78 }) as Waypoint;
        actions.addPoint(track.id, { lat: 41.7, lng: 44.79 });
        actions.removePoint(track.id, first);
        expect(points().map((point) => point.name)).toEqual(['002']);
        actions.removePoint(track.id, first);
        actions.renamePoint(track.id, first, 'Gone');
        expect(points().map((point) => point.name)).toEqual(['002']);
    });

    test('Скопировать координаты: пять знаков, долгота в ±180', async () => {
        const copied: string[] = [];
        const { actions, messages } = setup(async (text) => {
            copied.push(await text);
        });
        expect(pointCoordinates({ lat: 41.6912345, lng: 44.7812345 })).toBe('41.69123 44.78123');
        await actions.copyPointCoordinates({ lat: 41.6912345, lng: 404.7812345 });
        expect(copied).toEqual(['41.69123 44.78123']);
        expect(messages).toEqual(['Coordinates copied']);
    });

    test('буфер не дался — окно с координатами', async () => {
        const { store, actions } = setup(() => Promise.reject(new Error('denied')));
        await actions.copyPointCoordinates({ lat: -1.5, lng: -70.25 });
        expect(store.getState().copyFallback).toEqual({ title: 'Point coordinates', text: '-1.50000 -70.25000' });
    });
});
