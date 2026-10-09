import { describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '@/test/memory-storage';
import {
    forgetPosition,
    LEGACY_POSITION_KEY,
    loadPosition,
    POSITION_KEY,
    refreshPosition,
    savePosition,
} from './locate';

describe('запомненное положение', () => {
    it('своё положение', () => {
        const storage = memoryStorage();
        savePosition(storage, { lat: 41.69, lng: 44.78 });
        expect(storage.getItem(POSITION_KEY)).toBe('{"lat":41.69,"lng":44.78}');
        expect(loadPosition(storage)).toEqual({ lat: 41.69, lng: 44.78 });
    });

    it('без своего — положение старого клиента ({lat, lon})', () => {
        const storage = memoryStorage();
        storage.setItem(LEGACY_POSITION_KEY, '{"lat":55.7,"lon":37.6}');
        expect(loadPosition(storage)).toEqual({ lat: 55.7, lng: 37.6 });
    });

    it('забытое положение не возвращается откатом на старый ключ, старый ключ не трогается', () => {
        const storage = memoryStorage();
        storage.setItem(LEGACY_POSITION_KEY, '{"lat":55.7,"lon":37.6}');
        forgetPosition(storage);
        expect(loadPosition(storage)).toBeNull();
        expect(storage.getItem(LEGACY_POSITION_KEY)).toBe('{"lat":55.7,"lon":37.6}');
    });

    it.each(['garbage', '{"lat":0,"lng":0}', '{"lat":95,"lng":10}', '{}'])(
        'негодное значение %s — нет положения',
        (value) => {
            const storage = memoryStorage();
            storage.setItem(POSITION_KEY, value);
            expect(loadPosition(storage)).toBeNull();
        },
    );

    it('без хранилища — нет положения', () => {
        expect(loadPosition(null)).toBeNull();
    });
});

function fakeGeolocation(answer: { position?: [number, number]; error?: number }) {
    const getCurrentPosition = vi.fn(
        (success: PositionCallback, failure?: PositionErrorCallback | null, _options?: PositionOptions) => {
            if (answer.position) {
                success({
                    coords: { latitude: answer.position[0], longitude: answer.position[1] },
                } as GeolocationPosition);
            } else {
                failure?.({ code: answer.error, PERMISSION_DENIED: 1 } as GeolocationPositionError);
            }
        },
    );
    return { getCurrentPosition } as unknown as Geolocation & { getCurrentPosition: typeof getCurrentPosition };
}

describe('положение при заходе', () => {
    it('без запомненного положения браузер не спрашивается', () => {
        const geolocation = fakeGeolocation({ position: [1, 2] });
        refreshPosition(geolocation, memoryStorage(), () => {});
        expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('с запомненным — короткий запрос, новое положение запоминается', () => {
        const storage = memoryStorage();
        savePosition(storage, { lat: 41.69, lng: 44.78 });
        const geolocation = fakeGeolocation({ position: [42, 45] });
        const onPosition = vi.fn();
        refreshPosition(geolocation, storage, onPosition);
        expect(geolocation.getCurrentPosition.mock.calls[0][2]).toEqual({
            enableHighAccuracy: false,
            timeout: 500,
            maximumAge: 0,
        });
        expect(onPosition).toHaveBeenCalledWith({ lat: 42, lng: 45 });
        expect(loadPosition(storage)).toEqual({ lat: 42, lng: 45 });
    });

    it('отказ в доступе стирает положение', () => {
        const storage = memoryStorage();
        savePosition(storage, { lat: 41.69, lng: 44.78 });
        refreshPosition(fakeGeolocation({ error: 1 }), storage, () => {});
        expect(loadPosition(storage)).toBeNull();
    });
});
