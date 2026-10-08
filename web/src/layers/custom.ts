import { CUSTOM_BOTTOM_ORDER, CUSTOM_TOP_ORDER, type LayerDef, viaCorsProxy } from './catalog';

// Свои слои пользователя. Формат кода — как у старого клиента (serializeCustomLayer и loadCustomLayerFromString в
// src/lib/leaflet.control.layers.configure/index.js): `-cs` + URL-safe base64 от JSON полей формы, не-ASCII —
// через \uXXXX. Ключи JSON в том же порядке, поэтому ссылка со своим слоем читается обоими клиентами, а дубликаты
// ловятся сравнением кодов. Новое поле corsProxy старый клиент игнорирует (он грузит тайлы <img> без CORS).

export interface CustomLayerFields {
    name: string;
    url: string;
    tms: boolean;
    // нужно было только печати старого клиента; в форме нового нет, из старых кодов сохраняется как было
    scaleDependent: boolean;
    maxZoom: number;
    isOverlay: boolean;
    // над или под встроенными оверлеями; для подложки не важно
    isTop: boolean;
    corsProxy?: boolean;
}

const CODE_PREFIX = '-cs';

export function isCustomLayerCode(code: string): boolean {
    return code.startsWith(CODE_PREFIX);
}

export function serializeCustomLayer(fields: CustomLayerFields): string {
    const { corsProxy, ...rest } = fields;
    const json = JSON.stringify(corsProxy ? { ...rest, corsProxy: true } : rest).replace(
        /[\u007f-￿]/gu,
        (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
    return CODE_PREFIX + btoa(json).replace(/\+/gu, '-').replace(/\//gu, '_');
}

export function parseCustomLayerCode(code: string): CustomLayerFields | null {
    if (!isCustomLayerCode(code)) {
        return null;
    }
    let raw: unknown;
    try {
        raw = JSON.parse(atob(code.slice(CODE_PREFIX.length).replace(/-/gu, '+').replace(/_/gu, '/')));
    } catch {
        return null;
    }
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const fields = raw as Partial<CustomLayerFields>;
    if (typeof fields.url !== 'string' || typeof fields.name !== 'string') {
        return null;
    }
    // порядок ключей сохраняется (spread исходного объекта) — повторная сериализация даёт тот же код;
    // isTop без значения — коды до его появления, старый клиент считал их «над» (upgrade в loadCustomLayerFromString)
    return { ...fields, isTop: fields.isTop ?? true } as CustomLayerFields;
}

// Токены SAS Planet старого CustomLayer: MapLibre подставляет только свои токены, а transformRequest получает уже
// готовый адрес без z/x/y — поддержка стоила бы своего протокола загрузки (design, «Свои слои»)
const UNSUPPORTED_TOKENS = ['{z_1}', '{x_1024}', '{y_1024}'];

export function unsupportedTokens(url: string): string[] {
    return UNSUPPORTED_TOKENS.filter((token) => url.includes(token));
}

interface TileTemplates {
    tiles: string[];
    scheme: 'xyz' | 'tms';
}

// Шаблон Leaflet → токены MapLibre: {s} — адреса по поддоменам abc (умолчание L.TileLayer), {r} → {ratio},
// {-y} (перевёрнутый y) и флаг tms → scheme: 'tms'
export function tileTemplates(fields: CustomLayerFields, corsProxyUrl: string): TileTemplates {
    const flipped = fields.url.includes('{-y}');
    const template = fields.url.replaceAll('{-y}', '{y}').replaceAll('{r}', '{ratio}');
    const urls = template.includes('{s}') ? [...'abc'].map((s) => template.replaceAll('{s}', s)) : [template];
    return {
        tiles: fields.corsProxy ? urls.map((url) => viaCorsProxy(corsProxyUrl, url)) : urls,
        scheme: fields.tms || flipped ? 'tms' : 'xyz',
    };
}

export function customLayerDef(code: string, fields: CustomLayerFields, corsProxyUrl: string): LayerDef {
    const { tiles, scheme } = tileTemplates(fields, corsProxyUrl);
    return {
        code,
        title: fields.name,
        group: 'Custom layers',
        // места своих слоёв в порядке наложения — #custom-top и #custom-bottom старого каталога
        order: fields.isOverlay && fields.isTop ? CUSTOM_TOP_ORDER : CUSTOM_BOTTOM_ORDER,
        isOverlay: fields.isOverlay,
        isDefault: false,
        hotkey: null,
        source: { type: 'raster', tiles, scheme, tileSize: 256, maxzoom: fields.maxZoom },
    };
}

// Адрес одного тайла в центре вида — для проверки CORS. zoom — зум карты MapLibre; тайлы 256 px на нём имеют
// зум floor(zoom + 1), не глубже maxZoom слоя.
export function probeTileUrl(
    fields: CustomLayerFields,
    center: { lat: number; lng: number },
    zoom: number,
    corsProxyUrl: string,
): string {
    const { tiles, scheme } = tileTemplates(fields, corsProxyUrl);
    const z = Math.max(0, Math.min(Math.floor(zoom + 1), fields.maxZoom));
    const n = 2 ** z;
    const lat = Math.max(-85.05, Math.min(85.05, center.lat));
    const x = Math.min(n - 1, Math.floor((((((center.lng + 180) % 360) + 360) % 360) / 360) * n));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.min(n - 1, Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n));
    return tiles[0]
        .replaceAll('{z}', String(z))
        .replaceAll('{x}', String(x))
        .replaceAll('{y}', String(scheme === 'tms' ? n - 1 - y : y))
        .replaceAll('{ratio}', '');
}

export type CorsCheck = 'ok' | 'no-cors' | 'unreachable';

// CORS-запрос прошёл — сервер разрешает чтение (даже 404: тайла в центре может не быть). Не прошёл, а no-cors
// вернул ответ — сервер жив, но без CORS: тогда форма предлагает прокси. Упал и no-cors — сервер недоступен
// (или http:// со страницы https://).
export async function checkCors(url: string, fetchImpl: typeof fetch = fetch): Promise<CorsCheck> {
    try {
        await fetchImpl(url, { mode: 'cors' });
        return 'ok';
    } catch {
        // ниже — no-cors
    }
    try {
        await fetchImpl(url, { mode: 'no-cors' });
        return 'no-cors';
    } catch {
        return 'unreachable';
    }
}
