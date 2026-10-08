import { describe, expect, test } from 'vitest';
import { memoryStorage } from '@/test/memory-storage';
import { buildCatalog } from './catalog';
import { serializeCustomLayer } from './custom';
import {
    EMPTY_SETTINGS,
    hotkeyOf,
    isListed,
    LEGACY_STORAGE_KEY,
    loadSettings,
    STORAGE_KEY,
    saveSettings,
} from './settings';

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });
const layer = (code: string) => catalog.find((item) => item.code === code) ?? catalog[0];

const OLD_CUSTOM = serializeCustomLayer({
    name: 'NZ50',
    url: 'http://tiles-4.topomap.co.nz/tiles-topo50-20181002/{z}-{x}-{y}.png',
    tms: true,
    scaleDependent: false,
    maxZoom: 15,
    isOverlay: true,
    isTop: false,
});

describe('Настройки старого клиента', () => {
    test('Сохранённые настройки со старыми кодами', () => {
        const legacy = {
            layers: [
                { code: 'T', isCustom: false, enabled: true, hotkey: null },
                { code: 'F', isCustom: false, enabled: true },
                { code: 'Wp', isCustom: false, enabled: true, hotkey: 'W' },
                { code: 'Co', isCustom: false, enabled: false, hotkey: null },
                { code: 'Otm', isCustom: false, enabled: true, hotkey: 'T' },
                { code: OLD_CUSTOM, isCustom: true, enabled: true, hotkey: '5' },
            ],
        };
        const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) });
        const settings = loadSettings(storage, catalog);
        expect(settings.listed).toEqual({ Co: false, Otm: true, [OLD_CUSTOM]: true });
        expect(settings.hotkeys).toEqual({ Otm: 'T', [OLD_CUSTOM]: '5' });
        expect(settings.custom).toEqual([OLD_CUSTOM]);
        expect(isListed(layer('Co'), settings)).toBe(false);
        // старый ключ не трогается: старый клиент живёт на том же origin
        expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(JSON.stringify(legacy));
    });

    test('свой ключ важнее старого', () => {
        const storage = memoryStorage({
            [LEGACY_STORAGE_KEY]: JSON.stringify({ layers: [{ code: 'Co', enabled: false }] }),
        });
        saveSettings(storage, { ...EMPTY_SETTINGS, listed: { Co: true } });
        expect(loadSettings(storage, catalog).listed).toEqual({ Co: true });
    });

    test.each([
        ['битый JSON', 'not json'],
        ['не объект', '[1, 2]'],
        ['без layers', '{}'],
    ])('старые настройки: %s — умолчания', (_, raw) => {
        expect(loadSettings(memoryStorage({ [LEGACY_STORAGE_KEY]: raw }), catalog)).toEqual(EMPTY_SETTINGS);
    });

    test('битые свои настройки — пробуются старые', () => {
        const storage = memoryStorage({
            [STORAGE_KEY]: '{oops',
            [LEGACY_STORAGE_KEY]: JSON.stringify({ layers: [{ code: 'E', enabled: false }] }),
        });
        expect(loadSettings(storage, catalog).listed).toEqual({ E: false });
    });

    test('без хранилища и с хранилищем, которое бросает, — умолчания', () => {
        expect(loadSettings(null, catalog)).toEqual(EMPTY_SETTINGS);
        const throwing = {
            ...memoryStorage(),
            getItem: () => {
                throw new DOMException('denied', 'SecurityError');
            },
            setItem: () => {
                throw new DOMException('denied', 'SecurityError');
            },
        };
        expect(loadSettings(throwing, catalog)).toEqual(EMPTY_SETTINGS);
        expect(() => saveSettings(throwing, EMPTY_SETTINGS)).not.toThrow();
    });
});

describe('Выбор переживает перезагрузку', () => {
    test('свои настройки и последний выбор записываются и читаются обратно', () => {
        const storage = memoryStorage();
        const settings = {
            listed: { Co: false },
            hotkeys: { O: null, Otm: '7' },
            custom: [OLD_CUSTOM],
            selection: { base: 'E', overlays: ['Hs'] },
        };
        saveSettings(storage, settings);
        expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '')).toMatchObject({ version: 1 });
        expect(loadSettings(storage, catalog)).toEqual(settings);
    });
});

describe('умолчания каталога', () => {
    test('в списке — isDefault каталога, пока пользователь не решил иначе', () => {
        expect(isListed(layer('O'), EMPTY_SETTINGS)).toBe(true);
        expect(isListed(layer('Otm'), EMPTY_SETTINGS)).toBe(false);
        expect(isListed(layer('Hs'), EMPTY_SETTINGS)).toBe(true);
        expect(isListed(layer('Otm'), { ...EMPTY_SETTINGS, listed: { Otm: true } })).toBe(true);
    });

    test('хоткей: умолчание, свой, убранный', () => {
        expect(hotkeyOf(layer('Otm'), EMPTY_SETTINGS)).toBe('V');
        expect(hotkeyOf(layer('Otm'), { ...EMPTY_SETTINGS, hotkeys: { Otm: '7' } })).toBe('7');
        expect(hotkeyOf(layer('O'), { ...EMPTY_SETTINGS, hotkeys: { O: null } })).toBeNull();
    });
});
