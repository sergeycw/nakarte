// Street View в адресе — формат контрола панорам старого клиента (src/lib/leaflet.control.panoramas/index.js):
// n2=_g — режим включён (подчёркивание и коды провайдеров покрытия), n2=_g/g/lat/lng/heading/pitch/zoom — с панорамой
// (getState окна Google: toFixed(6) координат, toFixed(1) углов и зума). Старый n=lat/lng/heading/pitch/zoom — панорама
// Google до появления n2= (hashStateUpgrader). Коды удалённых провайдеров (w, m, c) режим не включают.

export interface PanoView {
    lat: number;
    lng: number;
    heading: number;
    pitch: number;
    zoom: number;
}

export interface StreetViewHash {
    enabled: boolean;
    pano: PanoView | null;
}

export const STREET_VIEW_PARAM = 'n2';
export const LEGACY_STREET_VIEW_PARAM = 'n';

const OFF: StreetViewHash = { enabled: false, pano: null };

function parsePano(values: readonly string[]): PanoView | null {
    if (values.length < 5) {
        return null;
    }
    const [lat, lng, heading, pitch, zoom] = values.slice(0, 5).map(Number.parseFloat);
    if ([lat, lng, heading, pitch, zoom].some(Number.isNaN) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return null;
    }
    return { lat, lng, heading, pitch, zoom };
}

function parseN2(values: readonly string[]): StreetViewHash {
    const coverage = values[0];
    if (!coverage?.startsWith('_') || !coverage.includes('g')) {
        return OFF;
    }
    const pano = values.length > 2 && values[1] === 'g' ? parsePano(values.slice(2)) : null;
    return { enabled: true, pano };
}

// n2 важнее n: старый клиент переводил n в n2 и больше n не писал
export function parseStreetView(n2: readonly string[] | undefined, n: readonly string[] | undefined): StreetViewHash {
    if (n2) {
        return parseN2(n2);
    }
    if (n) {
        return parseN2(n.length ? ['_g', 'g', ...n] : ['_g']);
    }
    return OFF;
}

export function formatStreetView({ enabled, pano }: StreetViewHash): string[] | null {
    if (!enabled) {
        return null;
    }
    if (!pano) {
        return ['_g'];
    }
    return [
        '_g',
        'g',
        pano.lat.toFixed(6),
        pano.lng.toFixed(6),
        pano.heading.toFixed(1),
        pano.pitch.toFixed(1),
        pano.zoom.toFixed(1),
    ];
}
