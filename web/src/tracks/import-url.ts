import { parseHash } from '@/state/hash';
import { isTrackParam, loadTrackParam } from './links';
import { type GeoData, geoData, type LatLng } from './model';
import { parseTrackUrlData } from './nktk';
import { parseGeoFile } from './parsers';
import { parseGpxText } from './parsers/gpx';
import { decodeXml } from './parsers/text';
import { fetchOrNull, proxied, type TrackSources } from './sources';

// Импорт трека по ссылке (services/ старого клиента). Сервисы — в его порядке, без Strava, Garmin Connect и Wikiloc
// (решение владельца, архив record-new-ui-decisions): их ссылки попадают в «любой файл» и дают unsupported format.
// Всё, что идёт во внешний сайт, — через CORS-прокси клона.

type Service = (url: string, sources: TrackSources) => Promise<GeoData[]> | GeoData[] | null;

async function bytesOf(response: Response) {
    return new Uint8Array(await response.arrayBuffer());
}

// Линейка Яндекс Карт: rl= — точки дельтами «lng,lat~lng,lat», без запросов в сеть
const yandexRuler: Service = (url) => {
    const match = /yandex\..+[?&]rl=([^&]+)/u.exec(url);
    if (!match) {
        return null;
    }
    const points: LatLng[] = [];
    let error: GeoData['error'];
    let lat = 0;
    let lng = 0;
    for (const pair of match[1].replace(/%2C/giu, ',').split('~')) {
        const [dLng, dLat] = pair.split(',').map(Number.parseFloat);
        if (Number.isNaN(dLat) || Number.isNaN(dLng) || dLat === undefined) {
            error = 'CORRUPT';
            break;
        }
        lng += dLng;
        lat += dLat;
        points.push({ lat, lng });
    }
    return [geoData('Yandex ruler', { segments: [points], error })];
};

const nakarteTrack: Service = (url) => {
    const index = url.indexOf('track://');
    return index > -1 ? parseTrackUrlData(url.slice(index + 'track://'.length)) : null;
};

// Ссылка nakarte (любого адреса) с параметрами треков в #
const nakarteUrl: Service = (url, sources) => {
    if (!url.includes('#')) {
        return null;
    }
    const params = [...parseHash(url)].filter(([key]) => isTrackParam(key));
    if (params.length === 0) {
        return null;
    }
    return Promise.all(
        params.map(([key, values]) => loadTrackParam(key as Parameters<typeof loadTrackParam>[0], values, sources)),
    ).then((loaded) => loaded.flat());
};

const osm: Service = (url, sources) => {
    const match = /^https?:\/\/(?:www\.)?openstreetmap\.org\/user\/(?:.*)\/traces\/(\d+)/u.exec(url);
    if (!match) {
        return null;
    }
    const id = match[1];
    return (async () => {
        const response = await fetchOrNull(sources, proxied(sources, `https://www.openstreetmap.org/trace/${id}/data`));
        if (!response?.ok) {
            return [geoData(url, { error: 'NETWORK' })];
        }
        const name = `OSM track ${id}`;
        return (
            parseGpxText(decodeXml(await bytesOf(response)), name, true) ?? [geoData(name, { error: 'UNSUPPORTED' })]
        );
    })();
};

// EPSG:3857 → широта и долгота (SphericalMercator.unproject Leaflet, R = 6 378 137 м)
function unprojectMercator(x: number, y: number): LatLng {
    const R = 6378137;
    const d = 180 / Math.PI;
    return { lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * d, lng: (x * d) / R };
}

const tracedetrail: Service = (url, sources) => {
    const match = /^https?:\/\/(?:www\.)?tracedetrail\.[a-z]{2,}.*\/(?:trace\/trace|trace|iframe)\/([0-9]+)/u.exec(url);
    if (!match) {
        return null;
    }
    return (async () => {
        let name = `Tracedetrail track ${match[1]}`;
        const response = await fetchOrNull(sources, proxied(sources, url));
        // удалённый трек сервис отдаёт кодом 500 со страницей
        if (!response || ![200, 500].includes(response.status)) {
            return [geoData(url, { error: 'NETWORK' })];
        }
        const page = await response.text();
        const geometry = /geometry\s*:\s*"(.+)",\n/u.exec(page);
        if (!geometry) {
            let error = 'UNSUPPORTED';
            if (page.includes("track doesn't exist") || response.status === 500) {
                error = '{name} was deleted or did not exist';
            } else if (page.includes('Private track')) {
                error = '{name} is private';
            }
            return [geoData(name, { error })];
        }
        const title = /<title>.+:\s*(.+)<\/title>/u.exec(page);
        if (title) {
            name = title[1];
        }
        try {
            const items = JSON.parse(geometry[1].replaceAll('\\"', '"')) as { lon: number; lat: number }[];
            return [geoData(name, { segments: [items.map((item) => unprojectMercator(item.lon, item.lat))] })];
        } catch {
            return [geoData(name, { error: 'UNSUPPORTED' })];
        }
    })();
};

interface SportsTrackerData {
    payload: { description?: string; locations: { la: number; ln: number }[] };
}
interface SportsTrackerMeta {
    payload: { startTime: number; fullname: string };
}

const sportsTracker: Service = (url, sources) => {
    const match = /^https?:\/\/(www\.)?sports-tracker\.com\/workout\/([^/]+)\/([a-z0-9]+)/u.exec(url);
    if (!match) {
        return null;
    }
    const api = `https://api.sports-tracker.com/apiserver/v1/workouts/${match[3]}`;
    return (async () => {
        const [data, meta] = await Promise.all([
            fetchOrNull(sources, proxied(sources, `${api}/data?samples=100000`)),
            fetchOrNull(sources, proxied(sources, `${api}/combined`)),
        ]);
        if (!data || !meta || ![200, 403].includes(data.status) || ![200, 403, 404].includes(meta.status)) {
            return [geoData(url, { error: 'NETWORK' })];
        }
        if (meta.status === 404) {
            return [geoData('', { error: 'Sports Tracker activity not found' })];
        }
        if (data.status === 403) {
            return [geoData('', { error: 'Sports Tracker user disabled viewing this activity' })];
        }
        let name = 'Sports Tracker activity';
        let dataJson: SportsTrackerData;
        let metaJson: SportsTrackerMeta;
        try {
            dataJson = await data.json();
            metaJson = await meta.json();
        } catch {
            return [geoData(name, { error: 'UNSUPPORTED' })];
        }
        const points = dataJson.payload.locations.map((location) => ({ lat: location.la, lng: location.ln }));
        if (dataJson.payload.description) {
            name = dataJson.payload.description;
        } else {
            name = `${metaJson.payload.fullname} on ${new Date(metaJson.payload.startTime).toDateString()}`;
        }
        return [geoData(name, { segments: [points] })];
    })();
};

// nameFromUrl старого клиента: последний сегмент пути без # и ?
export function nameFromUrl(url: string): string {
    let decoded = url;
    try {
        decoded = decodeURIComponent(url);
    } catch {
        // оставить как есть
    }
    return decoded.split('#')[0].split('?')[0].replace(/\/*$/u, '').split('/').pop() ?? decoded;
}

// Любой файл по http(s): формат — по содержимому
const anyFile: Service = (url, sources) => {
    if (!/^https?:\/\/.+/u.test(url)) {
        return null;
    }
    return (async () => {
        const response = await fetchOrNull(sources, proxied(sources, url));
        if (!response?.ok) {
            return [geoData(url, { error: 'NETWORK' })];
        }
        return parseGeoFile(nameFromUrl(response.url || url), await bytesOf(response));
    })();
};

const SERVICES: Service[] = [yandexRuler, nakarteTrack, nakarteUrl, osm, tracedetrail, sportsTracker, anyFile];

export async function loadFromUrl(url: string, sources: TrackSources): Promise<GeoData[]> {
    for (const service of SERVICES) {
        const result = service(url, sources);
        if (result !== null) {
            return result;
        }
    }
    return [geoData(url, { error: 'INVALID_URL' })];
}
