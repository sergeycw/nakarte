import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleMapsUrl, googleStreetView, loadGoogleMaps, resetGoogleMapsLoader } from './google';

// Загрузчик и обёртка Maps JavaScript API на поддельных document, window и google.maps (unit, Node): в Google тесты не
// ходят, настоящую вёрстку окна проверяет только прод.

afterEach(() => {
    resetGoogleMapsLoader();
    vi.unstubAllGlobals();
});

function fakeDocument() {
    const scripts: { src: string; async: boolean; onerror: (() => void) | null; remove: () => void }[] = [];
    const doc = {
        createElement: () => {
            const script = { src: '', async: false, onerror: null as (() => void) | null, remove: vi.fn() };
            return script;
        },
        head: { append: (script: (typeof scripts)[number]) => scripts.push(script) },
    };
    return { doc: doc as unknown as Document, scripts };
}

class FakePanorama {
    static last: FakePanorama;
    position: { lat: number; lng: number } | null = null;
    pov = { heading: 0, pitch: 0 };
    zoom = 1;
    visible = true;
    listeners = new Map<string, () => void>();
    options: Record<string, unknown>;
    constructor(_container: unknown, options: Record<string, unknown>) {
        this.options = options;
        FakePanorama.last = this;
    }
    getPosition() {
        const position = this.position;
        return position && { lat: () => position.lat, lng: () => position.lng };
    }
    setPosition(position: { lat: number; lng: number }) {
        this.position = position;
        this.listeners.get('position_changed')?.();
    }
    getPov() {
        return this.pov;
    }
    setPov(pov: { heading: number; pitch: number }) {
        this.pov = pov;
        this.listeners.get('pov_changed')?.();
    }
    getZoom() {
        return this.zoom;
    }
    setZoom(zoom: number) {
        this.zoom = zoom;
    }
    setVisible(visible: boolean) {
        this.visible = visible;
    }
    addListener(event: string, handler: () => void) {
        this.listeners.set(event, handler);
    }
}

function fakeMaps(found: { lat: number; lng: number } | null) {
    const requests: unknown[] = [];
    return {
        requests,
        maps: {
            StreetViewPanorama: FakePanorama,
            StreetViewService: class {
                getPanorama(request: unknown, callback: (data: unknown, status: string) => void) {
                    requests.push(request);
                    callback(
                        found ? { location: { latLng: { lat: () => found.lat, lng: () => found.lng } } } : null,
                        found ? 'OK' : 'ZERO_RESULTS',
                    );
                }
            },
            StreetViewPreference: { NEAREST: 'nearest' },
            StreetViewStatus: { OK: 'OK' },
            event: { trigger: vi.fn(), clearInstanceListeners: vi.fn() },
        },
    };
}

describe('загрузка Maps JavaScript API', () => {
    it('адрес старого клиента с пустым ключом и колбэком', () => {
        expect(googleMapsUrl('')).toBe(
            'https://maps.googleapis.com/maps/api/js?v=3&key=&callback=__nakarteGoogleMapsReady',
        );
        expect(googleMapsUrl('AIza x')).toContain('key=AIza%20x');
    });

    it('один скрипт на страницу; колбэк отдаёт google.maps', async () => {
        const { doc, scripts } = fakeDocument();
        const win = {} as Record<string, unknown>;
        const first = loadGoogleMaps('', doc, win as never);
        const second = loadGoogleMaps('', doc, win as never);
        expect(scripts).toHaveLength(1);
        expect(scripts[0].src).toBe(googleMapsUrl(''));
        win.google = { maps: fakeMaps(null).maps };
        (win.__nakarteGoogleMapsReady as () => void)();
        expect(await first).toBe((win.google as { maps: unknown }).maps);
        expect(await second).toBe(await first);
    });

    it('ошибка загрузки — исключение, следующая попытка — новый скрипт', async () => {
        const { doc, scripts } = fakeDocument();
        const win = {} as Record<string, unknown>;
        const first = loadGoogleMaps('', doc, win as never);
        scripts[0].onerror?.();
        await expect(first).rejects.toThrow('Maps JavaScript API failed to load');
        expect(scripts[0].remove).toHaveBeenCalled();
        void loadGoogleMaps('', doc, win as never).catch(() => {});
        expect(scripts).toHaveLength(2);
    });

    it('колбэк без google.maps — ошибка', async () => {
        const { doc } = fakeDocument();
        const win = {} as Record<string, unknown>;
        const loading = loadGoogleMaps('', doc, win as never);
        (win.__nakarteGoogleMapsReady as () => void)();
        await expect(loading).rejects.toThrow();
    });
});

describe('Street View на Google', () => {
    it('поиск: ближайшая панорама в радиусе', async () => {
        const fake = fakeMaps({ lat: 41.6931, lng: 44.7801 });
        vi.stubGlobal('window', { google: { maps: fake.maps } });
        const api = googleStreetView('');
        expect(await api.findPanorama({ lat: 41.693, lng: 44.78 }, 30)).toEqual({ lat: 41.6931, lng: 44.7801 });
        expect(fake.requests).toEqual([{ location: { lat: 41.693, lng: 44.78 }, radius: 30, preference: 'nearest' }]);
    });

    it('ZERO_RESULTS — null', async () => {
        vi.stubGlobal('window', { google: { maps: fakeMaps(null).maps } });
        expect(await googleStreetView('').findPanorama({ lat: 1, lng: 1 }, 30)).toBeNull();
    });

    it('окно: класс режима без ключа, вид, события, destroy', async () => {
        const fake = fakeMaps(null);
        vi.stubGlobal('window', { google: { maps: fake.maps } });
        const classes = new Set<string>();
        const container = {
            classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
        } as unknown as HTMLElement;
        const changes: unknown[] = [];
        const viewer = await googleStreetView('').createViewer(container, { onChange: (view) => changes.push(view) });
        expect(classes.has('google-street-view-keyless')).toBe(true);
        expect(FakePanorama.last.options).toMatchObject({ imageDateControl: true, motionTracking: false });
        viewer.show({ lat: 41.693, lng: 44.78, heading: 90, pitch: 5, zoom: 2 });
        expect(FakePanorama.last.zoom).toBe(2);
        expect(changes.at(-1)).toEqual({ lat: 41.693, lng: 44.78, heading: 90, pitch: 5, zoom: 1 });
        viewer.destroy();
        FakePanorama.last.setPov({ heading: 10, pitch: 0 });
        expect(changes.at(-1)).toMatchObject({ heading: 90 });
        expect(fake.maps.event.clearInstanceListeners).toHaveBeenCalled();
        expect(FakePanorama.last.visible).toBe(false);

        const keyed = await googleStreetView('AIza').createViewer(container, { onChange: () => {} });
        expect(classes.has('google-street-view-keyless')).toBe(false);
        keyed.destroy();
    });
});
