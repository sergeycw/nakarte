// Адрес нового приложения в формате старого клиента (src/lib/leaflet.hashState/hashState.js):
// `#k=v1/v2&k2` — пары через `&`, значения через `/`, ключ без `=` — пустой список. Значения не декодируются:
// старый клиент их не кодировал и не раскодировал, а старые ссылки должны читаться и собираться обратно байт в байт.
// Параметры, которые приложение пока не понимает (nktk, nktl, q, r, n2, p…), остаются на своих местах:
// их разберут следующие changes, а пользователь не теряет их при движении карты.

export type HashParams = ReadonlyMap<string, readonly string[]>;

export function parseHash(hash: string): HashParams {
    const params = new Map<string, string[]>();
    const start = hash.indexOf('#');
    const body = (start >= 0 ? hash.slice(start + 1) : hash).trim();
    if (!body) {
        return params;
    }
    for (const pair of body.split('&')) {
        // ленивый ключ, как в parseHashParams: всё после первого `=` — значение, `=` в base64 своих слоёв остаются
        const match = /^([^=]+?)(?:=(.*))?$/u.exec(pair);
        if (!match) {
            continue;
        }
        const [, key, value] = match;
        params.set(key, value ? value.split('/') : []);
    }
    return params;
}

export function formatHash(params: HashParams): string {
    const items: string[] = [];
    for (const [key, values] of params) {
        items.push(values.length ? `${key}=${values.join('/')}` : key);
    }
    return items.join('&');
}

// null удаляет ключ; новый ключ встаёт в конец, существующий остаётся на своём месте
export function withParam(params: HashParams, key: string, values: readonly string[] | null): HashParams {
    const next = new Map(params);
    if (values === null) {
        next.delete(key);
    } else {
        next.set(key, values);
    }
    return next;
}

export interface View {
    lat: number;
    lng: number;
    // зум MapLibre: мир на z0 у него 512 px, у Leaflet 256 px, поэтому тот же масштаб на 1 меньше
    zoom: number;
}

// m=zoom/lat/lng с зумом старого клиента. Проверки — validateState старого Leaflet.Map.js; зум читается
// дробным, потому что новое приложение пишет его дробным (старый клиент прочтёт parseInt).
export function parseView(values: readonly string[] | undefined): View | null {
    if (values?.length !== 3) {
        return null;
    }
    const [zoom, lat, lng] = values.map(Number.parseFloat);
    if ([zoom, lat, lng].some(Number.isNaN) || zoom < 0 || zoom > 32 || lat < -90 || lat > 90) {
        return null;
    }
    return { lat, lng, zoom: Math.max(0, zoom - 1) };
}

export function formatView({ lat, lng, zoom }: View): string[] {
    const leafletZoom = Math.round((zoom + 1) * 100) / 100;
    return [String(leafletZoom), lat.toFixed(5), lng.toFixed(5)];
}
