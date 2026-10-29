import { describe, expect, test } from 'vitest';
import { buildCatalog } from './catalog';
import {
    QUICK_BASE_GROUPS,
    QUICK_BASES,
    QUICK_OVERLAY_GROUPS,
    quickGroupOf,
    quickTarget,
    rememberQuickLayer,
} from './quick-layers';

// Группы столбца справа и память кругов (design quick-layer-menus). Названия describe — требования спеки map-layers.

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });
const byCode = new Map(catalog.map((layer) => [layer.code, layer]));
const [topo, maps, satellite] = QUICK_BASE_GROUPS;

describe('Меню слоёв столбца', () => {
    test('группы подложек — подложки каталога, каждая подложка кроме снимков по датам в одной группе', () => {
        const codes = QUICK_BASE_GROUPS.flatMap((group) => group.codes);
        expect(new Set(codes).size).toBe(codes.length);
        expect(codes.filter((code) => byCode.get(code)?.isOverlay !== false)).toEqual([]);
        // новая подложка каталога без группы валит тест: решение «в какой круг» не теряется
        const bases = catalog.filter((layer) => !layer.isOverlay && !layer.dated).map((layer) => layer.code);
        expect([...bases].sort()).toEqual([...codes].sort());
    });

    test('группа хитмэпов — оверлеи каталога, коды не пересекаются с подложками', () => {
        const codes = QUICK_OVERLAY_GROUPS.flatMap((group) => group.codes);
        expect(codes.filter((code) => byCode.get(code)?.isOverlay !== true)).toEqual([]);
        expect(codes.filter((code) => quickGroupOf(code)?.codes.includes(code) !== true)).toEqual([]);
        expect(codes.filter((code) => QUICK_BASE_GROUPS.some((group) => group.codes.includes(code)))).toEqual([]);
    });

    test('круги — первые подложки групп, у них есть превью', () => {
        expect(QUICK_BASES).toEqual(['Tt', 'G', 'E']);
    });
});

describe('Круг помнит выбор типа', () => {
    test('выбор запоминается за первым кодом группы, вне групп — тот же объект', () => {
        const memory = rememberQuickLayer({}, 'I');
        expect(memory).toEqual({ E: 'I' });
        expect(rememberQuickLayer(memory, 'I')).toBe(memory);
        expect(rememberQuickLayer(memory, 'Hls')).toBe(memory);
        expect(rememberQuickLayer(memory, 'Hs')).toBe(memory);
        expect(rememberQuickLayer(memory, 'Sr')).toEqual({ E: 'I', Sa: 'Sr' });
    });

    test('цель нажатия: слой на карте, иначе запомненный из меню, иначе первый', () => {
        const menu = satellite.codes;
        expect(quickTarget(satellite, {}, undefined, menu)).toBe('E');
        expect(quickTarget(satellite, { E: 'I' }, undefined, menu)).toBe('I');
        // отмеченный круг остаётся на текущем слое, даже если запомнен другой
        expect(quickTarget(satellite, { E: 'I' }, 'L', menu)).toBe('L');
        // запомненного нет в меню (снят в Configure layers) — первый слой группы
        expect(quickTarget(satellite, { E: 'I' }, undefined, ['E', 'L', 'S2'])).toBe('E');
        expect(quickTarget(topo, { E: 'I' }, undefined, topo.codes)).toBe('Tt');
        expect(quickTarget(maps, { G: 'P' }, undefined, maps.codes)).toBe('P');
    });
});
