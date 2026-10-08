import { describe, expect, test } from 'vitest';
import { buildCatalog } from '@/layers/catalog';
import type { CustomLayerFields } from '@/layers/custom';
import { EMPTY_SETTINGS } from '@/layers/settings';
import { createAppStore } from './store';

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });

function store() {
    return createAppStore({
        catalog,
        corsProxyUrl: 'https://proxy.test/',
        settings: EMPTY_SETTINGS,
        selection: { base: 'O', overlays: [] },
        view: { lat: 0, lng: 0, zoom: 1 },
    });
}

const OVERLAY: CustomLayerFields = {
    name: 'Custom',
    url: 'https://tiles.example.test/{z}/{x}/{y}.png',
    tms: false,
    scaleDependent: false,
    maxZoom: 18,
    isOverlay: true,
    isTop: true,
};

describe('выбор слоёв', () => {
    test('Сменить подложку: только подложки, оверлей подложкой не становится', () => {
        const s = store();
        s.getState().selectBase('Otm');
        expect(s.getState().selection.base).toBe('Otm');
        s.getState().selectBase('Wh');
        expect(s.getState().selection.base).toBe('Otm');
    });

    test('оверлей включается и выключается, подложка оверлеем не включается', () => {
        const s = store();
        s.getState().toggleOverlay('Wh');
        s.getState().toggleOverlay('E');
        expect(s.getState().selection.overlays).toEqual(['Wh']);
        s.getState().toggleOverlay('Wh');
        expect(s.getState().selection.overlays).toEqual([]);
    });
});

describe('свои слои', () => {
    test('Добавить свой слой: в списке, включён, с переводом шаблона', () => {
        const s = store();
        const code = s.getState().addCustomLayer(OVERLAY);
        expect(s.getState().settings.custom).toEqual([code]);
        expect(s.getState().selection.overlays).toEqual([code]);
        expect(s.getState().layers.get(code)?.source.tiles).toEqual(['https://tiles.example.test/{z}/{x}/{y}.png']);
    });

    test('новая подложка заменяет текущую', () => {
        const s = store();
        const code = s.getState().addCustomLayer({ ...OVERLAY, isOverlay: false });
        expect(s.getState().selection).toEqual({ base: code, overlays: [] });
    });

    test('изменение: новый код, включённый слой остаётся включённым, видимость в списке переезжает', () => {
        const s = store();
        const code = s.getState().addCustomLayer(OVERLAY);
        const next = s.getState().replaceCustomLayer(code, { ...OVERLAY, corsProxy: true });
        expect(next).not.toBe(code);
        expect(s.getState().settings.custom).toEqual([next]);
        expect(s.getState().settings.listed).toEqual({ [next]: true });
        expect(s.getState().selection.overlays).toEqual([next]);
        expect(s.getState().layers.get(next)?.source.tiles?.[0]).toMatch(/^https:\/\/proxy\.test\/https\//);
    });

    test('оверлей, ставший подложкой, выключается, как у старого клиента', () => {
        const s = store();
        const code = s.getState().addCustomLayer(OVERLAY);
        s.getState().replaceCustomLayer(code, { ...OVERLAY, isOverlay: false });
        expect(s.getState().selection).toEqual({ base: 'O', overlays: [] });
    });

    test('удалённая подложка — выбор возвращается к умолчанию', () => {
        const s = store();
        const code = s.getState().addCustomLayer({ ...OVERLAY, isOverlay: false });
        s.getState().removeCustomLayer(code);
        expect(s.getState().selection).toEqual({ base: 'O', overlays: [] });
        expect(s.getState().layers.has(code)).toBe(false);
    });
});
