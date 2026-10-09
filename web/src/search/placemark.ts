// Метка найденного места и её параметр адреса r=lat/lng/название — формат PlacemarkHashStateInterface старого клиента
// (src/lib/leaflet.placemark/index.js): координаты toFixed(6), название через encodeURIComponent (значения адреса
// делятся по «/», и «/» в названии кодируется). «Copy link» r= не включает (keysToExcludeOnCopyLink, tracks/share.ts).

export interface Placemark {
    lat: number;
    lng: number;
    title: string;
}

export const PLACEMARK_PARAM = 'r';

export function parsePlacemark(values: readonly string[] | undefined): Placemark | null {
    if (!values?.length) {
        return null;
    }
    const lat = Number.parseFloat(values[0]);
    const lng = Number.parseFloat(values[1] ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }
    let title = values[2] ?? '';
    try {
        title = decodeURIComponent(title);
    } catch {
        // испорченная последовательность % — название как есть, метку не теряем
    }
    return { lat, lng, title };
}

export function formatPlacemark({ lat, lng, title }: Placemark): string[] {
    return [lat.toFixed(6), lng.toFixed(6), encodeURIComponent(title)];
}
