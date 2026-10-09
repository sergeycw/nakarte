import type { LatLng } from '@/tracks/model';

// Последнее положение пользователя (design add-web-search-panoramas, «Геолокация»): moveMapToCurrentLocation старого
// клиента (src/lib/leaflet.control.locate/index.js). Пишется на каждое полученное положение, стирается на отказ в доступе.
// Свой ключ; без него читается ключ старого клиента (тот же origin) — его не трогаем: забытое положение записывается
// как null, чтобы откат на старый ключ не вернул его.

export const POSITION_KEY = 'nakarte-web:position';
export const LEGACY_POSITION_KEY = 'leaflet_locate_position';

function parse(text: string | null, lngField: 'lng' | 'lon'): LatLng | null {
    try {
        const value = JSON.parse(text ?? 'null') as Record<string, unknown> | null;
        const lat = Number(value?.lat);
        const lng = Number(value?.[lngField]);
        // нули — «нет положения», как проверка `lat && lon` старого
        if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            return null;
        }
        return { lat, lng };
    } catch {
        return null;
    }
}

export function loadPosition(storage: Storage | null): LatLng | null {
    if (!storage) {
        return null;
    }
    try {
        const own = storage.getItem(POSITION_KEY);
        if (own !== null) {
            return parse(own, 'lng');
        }
        return parse(storage.getItem(LEGACY_POSITION_KEY), 'lon');
    } catch {
        return null;
    }
}

export function savePosition(storage: Storage | null, { lat, lng }: LatLng) {
    try {
        storage?.setItem(POSITION_KEY, JSON.stringify({ lat, lng }));
    } catch {
        // хранилище недоступно — положение не запоминается
    }
}

export function forgetPosition(storage: Storage | null) {
    try {
        storage?.setItem(POSITION_KEY, 'null');
    } catch {
        // хранилище недоступно
    }
}

// Короткий запрос текущего положения при заходе (таймаут 500 мс, без высокой точности) — только если положение уже
// запомнено: значит, разрешение давали, и подсказки браузера не будет
export function refreshPosition(
    geolocation: Geolocation | undefined,
    storage: Storage | null,
    onPosition: (position: LatLng) => void,
) {
    if (!geolocation || !loadPosition(storage)) {
        return;
    }
    geolocation.getCurrentPosition(
        (position) => {
            const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
            savePosition(storage, latlng);
            onPosition(latlng);
        },
        (error) => {
            if (error.code === error.PERMISSION_DENIED) {
                forgetPosition(storage);
            }
        },
        { enableHighAccuracy: false, timeout: 500, maximumAge: 0 },
    );
}
