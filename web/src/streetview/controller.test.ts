import { describe, expect, it, vi } from 'vitest';
import { buildCatalog } from '@/layers/catalog';
import { EMPTY_SETTINGS } from '@/layers/settings';
import { createAppStore } from '@/state/store';
import type { LatLng } from '@/tracks/model';
import type { StreetViewApi } from './api';
import { createStreetView, UNAVAILABLE_MESSAGE } from './controller';

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });

function setup(find: (at: LatLng, radius: number) => Promise<LatLng | null>) {
    const store = createAppStore({
        catalog,
        corsProxyUrl: 'https://proxy.test/',
        settings: EMPTY_SETTINGS,
        selection: { base: 'O', overlays: [] },
        view: { lat: 41.69, lng: 44.78, zoom: 15 },
    });
    const api: StreetViewApi = { findPanorama: vi.fn(find), createViewer: vi.fn() };
    const notify = vi.fn();
    return { store, api, notify, streetView: createStreetView({ store, api, notify }) };
}

describe('поиск панорамы по клику', () => {
    it('Панорама найдена: окно туда, взгляд прежний', async () => {
        const { store, streetView, api } = setup(async () => ({ lat: 41.6931, lng: 44.7801 }));
        streetView.toggle();
        store.getState().requestPano({ lat: 41.69, lng: 44.78, heading: 45, pitch: 10, zoom: 2 });
        await streetView.searchAt({ lat: 41.693, lng: 44.78 }, 30);
        expect(api.findPanorama).toHaveBeenCalledWith({ lat: 41.693, lng: 44.78 }, 30);
        expect(store.getState().streetView.pano).toEqual({
            lat: 41.6931,
            lng: 44.7801,
            heading: 45,
            pitch: 0,
            zoom: 1,
        });
    });

    it('Панорамы рядом нет — ничего не меняется', async () => {
        const { store, streetView } = setup(async () => null);
        streetView.toggle();
        await streetView.searchAt({ lat: 41.693, lng: 44.78 }, 30);
        expect(store.getState().streetView).toEqual({ enabled: true, pano: null, request: null });
    });

    it('режим выключен — не ищет', async () => {
        const { streetView, api } = setup(async () => null);
        await streetView.searchAt({ lat: 41.693, lng: 44.78 }, 30);
        expect(api.findPanorama).not.toHaveBeenCalled();
    });

    it('устаревший ответ отбрасывается: новый клик и выключение', async () => {
        let resolveFirst!: (value: LatLng) => void;
        const answers = [
            new Promise<LatLng>((resolve) => {
                resolveFirst = resolve;
            }),
            Promise.resolve({ lat: 2, lng: 2 }),
        ];
        const { store, streetView } = setup(() => answers.shift() as Promise<LatLng>);
        streetView.toggle();
        const first = streetView.searchAt({ lat: 1, lng: 1 }, 30);
        await streetView.searchAt({ lat: 2, lng: 2 }, 30);
        resolveFirst({ lat: 1, lng: 1 });
        await first;
        expect(store.getState().streetView.pano).toMatchObject({ lat: 2, lng: 2 });
    });

    it('ответ после выключения режима панораму не открывает', async () => {
        let resolve!: (value: LatLng) => void;
        const { store, streetView } = setup(
            () =>
                new Promise((res) => {
                    resolve = res;
                }),
        );
        streetView.toggle();
        const search = streetView.searchAt({ lat: 1, lng: 1 }, 30);
        streetView.toggle();
        resolve({ lat: 1, lng: 1 });
        await search;
        expect(store.getState().streetView).toEqual({ enabled: false, pano: null, request: null });
    });

    it('API не загрузился — тост', async () => {
        const { streetView, notify } = setup(async () => {
            throw new Error('load failed');
        });
        streetView.toggle();
        await streetView.searchAt({ lat: 1, lng: 1 }, 30);
        expect(notify).toHaveBeenCalledWith(UNAVAILABLE_MESSAGE, 'error');
    });

    it('закрытие оставляет режим', () => {
        const { store, streetView } = setup(async () => null);
        store.getState().requestPano({ lat: 1, lng: 1, heading: 0, pitch: 0, zoom: 1 });
        streetView.close();
        expect(store.getState().streetView).toEqual({ enabled: true, pano: null, request: null });
    });
});
