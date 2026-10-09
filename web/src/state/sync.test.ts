import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { buildCatalog } from '@/layers/catalog';
import { serializeCustomLayer } from '@/layers/custom';
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '@/layers/settings';
import { memoryStorage } from '@/test/memory-storage';
import { type AddressWindow, bindAppStore, startAppStore, type TrackParamsHandler } from './sync';

const catalog = buildCatalog({ pixelRatio: 1, language: 'en', corsProxyUrl: 'https://proxy.test/' });
const DEFAULT_VIEW = { lat: 49.73868, lng: 33.45886, zoom: 7 };

function fakeWindow(hash: string) {
    const listeners = new Set<() => void>();
    const win = {
        location: { hash: hash ? `#${hash}` : '', pathname: '/next/', search: '' },
        history: {
            replaceState: vi.fn((_data: unknown, _unused: string, url: string) => {
                win.location.hash = url.slice(url.indexOf('#'));
            }),
        },
        addEventListener: (_type: 'hashchange', listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: 'hashchange', listener: () => void) => listeners.delete(listener),
        // пользователь поменял адрес руками
        navigate(next: string) {
            win.location.hash = `#${next}`;
            for (const listener of listeners) {
                listener();
            }
        },
    } satisfies AddressWindow & { navigate(next: string): void };
    return win;
}

function start(hash: string, storage = memoryStorage(), onTrackParams?: TrackParamsHandler) {
    const win = fakeWindow(hash);
    const store = startAppStore({
        catalog,
        corsProxyUrl: 'https://proxy.test/',
        defaultView: DEFAULT_VIEW,
        hash,
        storage,
    });
    const unbind = bindAppStore(store, win, storage, onTrackParams);
    return { win, store, storage, unbind };
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('старт', () => {
    test('Первый заход без настроек: OSM и вид по умолчанию сразу в адресе', () => {
        const { win, store } = start('');
        expect(store.getState().selection).toEqual({ base: 'O', overlays: [] });
        expect(win.location.hash).toBe('#m=8/49.73868/33.45886&l=O');
    });

    test('Ссылка с видом и слоями: прочие параметры остаются на местах', () => {
        const { win, store } = start('m=13/42.68490/47.07008&l=O/K&p=abc');
        expect(store.getState().view).toEqual({ lat: 42.6849, lng: 47.07008, zoom: 12 });
        expect(win.location.hash).toBe('#m=13/42.68490/47.07008&l=O&p=abc');
    });

    test('Неверный вид в ссылке — вид по умолчанию', () => {
        const { store } = start('m=99/49.44893/52.5547&l=O');
        expect(store.getState().view).toEqual(DEFAULT_VIEW);
    });

    test('Перезагрузка без l=: последний выбор из localStorage', () => {
        const storage = memoryStorage();
        const first = start('', storage);
        first.store.getState().selectBase('E');
        first.store.getState().toggleOverlay('Hs');
        first.unbind();
        const second = start('', storage);
        expect(second.store.getState().selection).toEqual({ base: 'E', overlays: ['Hs'] });
        expect(second.win.location.hash).toBe('#m=8/49.73868/33.45886&l=E/Hs');
    });

    test('годный l= важнее сохранённого выбора и сам становится последним, негодный — нет', () => {
        const storage = memoryStorage();
        start('', storage).store.getState().selectBase('E');
        expect(start('l=Otm', storage).store.getState().selection.base).toBe('Otm');
        expect(start('l=F', storage).store.getState().selection.base).toBe('Otm');
    });

    test('Ссылка со своим слоем: слой добавляется в список и в настройки', () => {
        const code = serializeCustomLayer({
            name: 'Custom',
            url: 'https://tiles.example.test/{z}/{x}/{y}.png',
            tms: false,
            scaleDependent: false,
            maxZoom: 18,
            isOverlay: true,
            isTop: true,
        });
        const { store, storage } = start(`l=O/${code}`);
        expect(store.getState().selection.overlays).toEqual([code]);
        expect(store.getState().layers.get(code)?.title).toBe('Custom');
        expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '').custom).toEqual([code]);
    });

    test('слой из ссылки, скрытый в настройках, становится видимым в списке', () => {
        const storage = memoryStorage({
            [LEGACY_STORAGE_KEY]: JSON.stringify({ layers: [{ code: 'Co', enabled: false }] }),
        });
        expect(start('l=Co', storage).store.getState().settings.listed.Co).toBe(true);
    });
});

describe('запись в адрес', () => {
    test('Вид пишется в адрес не чаще раза в 300 мс, p= остаётся', () => {
        const { win, store } = start('m=10/41/44&p=1');
        store.getState().setView({ lat: 41.5, lng: 44.5, zoom: 10 });
        store.getState().setView({ lat: 41.6, lng: 44.6, zoom: 10.5 });
        expect(win.location.hash).toBe('#m=10/41.00000/44.00000&p=1&l=O');
        vi.advanceTimersByTime(300);
        expect(win.location.hash).toBe('#m=11.5/41.60000/44.60000&p=1&l=O');
    });

    test('смена слоёв пишется сразу, оверлеи — по порядку наложения', () => {
        const { win, store } = start('');
        store.getState().toggleOverlay('Sa');
        store.getState().toggleOverlay('Nm');
        expect(win.location.hash).toBe('#m=8/49.73868/33.45886&l=O/Nm/Sa');
    });
});

describe('адрес поменяли руками', () => {
    test('новый m= переводит карту, новый l= меняет слои', () => {
        const { win, store } = start('');
        win.navigate('m=13/42.68490/47.07008&l=Otm/Wh');
        expect(store.getState().viewRequest?.view).toEqual({ lat: 42.6849, lng: 47.07008, zoom: 12 });
        expect(store.getState().selection).toEqual({ base: 'Otm', overlays: ['Wh'] });
    });

    test('без m= и l= — адрес дополняется текущим состоянием, карта не прыгает', () => {
        const { win, store } = start('');
        win.navigate('p=key');
        expect(store.getState().viewRequest).toBeNull();
        expect(win.location.hash).toBe('#p=key&m=8/49.73868/33.45886&l=O');
    });
});

describe('параметры треков', () => {
    test('Ссылка без вида: параметр уходит из адреса, карта покажет треки целиком', () => {
        const onTrackParams = vi.fn();
        const { win } = start('nktk=abc/def&l=O', memoryStorage(), onTrackParams);
        expect(onTrackParams).toHaveBeenCalledExactlyOnceWith([['nktk', ['abc', 'def']]], true);
        expect(win.location.hash).toBe('#l=O&m=8/49.73868/33.45886');
    });

    test('с годным m= вид не меняется, остальные параметры на местах', () => {
        const onTrackParams = vi.fn();
        const { win } = start('m=10/41/44&nktl=key&p=1&nktp=41/44/x', memoryStorage(), onTrackParams);
        expect(onTrackParams).toHaveBeenCalledExactlyOnceWith(
            [
                ['nktl', ['key']],
                ['nktp', ['41', '44', 'x']],
            ],
            false,
        );
        expect(win.location.hash).toBe('#m=10/41.00000/44.00000&p=1&l=O');
    });

    test('Ссылка вставлена в адрес: параметр с hashchange тоже грузится и стирается', () => {
        const onTrackParams = vi.fn();
        const { win } = start('m=10/41/44&l=O', memoryStorage(), onTrackParams);
        expect(onTrackParams).not.toHaveBeenCalled();
        win.navigate('m=10/41.00000/44.00000&l=O&nktp=41.7/44.8/Tbilisi');
        expect(onTrackParams).toHaveBeenCalledExactlyOnceWith([['nktp', ['41.7', '44.8', 'Tbilisi']]], false);
        expect(win.location.hash).toBe('#m=10/41.00000/44.00000&l=O');
    });

    test('пустой параметр стирается без загрузки', () => {
        const onTrackParams = vi.fn();
        const { win } = start('m=10/41/44&l=O&nktk', memoryStorage(), onTrackParams);
        expect(onTrackParams).not.toHaveBeenCalled();
        expect(win.location.hash).toBe('#m=10/41.00000/44.00000&l=O');
    });
});

describe('метка поиска r=', () => {
    test('Ссылка с меткой: метка в сторе, r= остаётся в адресе', () => {
        const { win, store } = start('m=13/41.69/44.78&l=O&r=41.693040/44.779477/Mtatsminda%20Park');
        expect(store.getState().placemark).toEqual({ lat: 41.69304, lng: 44.779477, title: 'Mtatsminda Park' });
        expect(win.location.hash).toBe('#m=13/41.69000/44.78000&l=O&r=41.693040/44.779477/Mtatsminda%20Park');
    });

    test('новая метка пишется в адрес сразу, снятая — уходит из адреса', () => {
        const { win, store } = start('m=13/41.69/44.78&l=O');
        store.getState().setPlacemark({ lat: 41.7, lng: 44.8, title: 'Камень' });
        expect(win.location.hash).toBe(
            '#m=13/41.69000/44.78000&l=O&r=41.700000/44.800000/%D0%9A%D0%B0%D0%BC%D0%B5%D0%BD%D1%8C',
        );
        store.getState().setPlacemark(null);
        expect(win.location.hash).toBe('#m=13/41.69000/44.78000&l=O');
    });

    test('правка адреса меняет метку, неверная r= метку снимает', () => {
        const { win, store } = start('m=13/41.69/44.78&l=O');
        win.navigate('m=13/41.69/44.78&l=O&r=1/2/x');
        expect(store.getState().placemark).toEqual({ lat: 1, lng: 2, title: 'x' });
        win.navigate('m=13/41.69/44.78&l=O&r=99/2/x');
        expect(store.getState().placemark).toBeNull();
        expect(win.location.hash).toBe('#m=13/41.69000/44.78000&l=O');
    });
});
