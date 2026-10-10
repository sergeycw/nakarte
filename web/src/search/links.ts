import { fromLeafletZoom, type SearchResponse, type SearchResult } from './result';

// Ссылки на карты в строке поиска — порт LinksProvider старого клиента
// (src/lib/leaflet.control.search/providers/links.js): Яндекс, Google, mapy.com, OSM, nakarte. Зум в ссылках —
// старого клиента (Leaflet), в результате — MapLibre. Короткие ссылки goo.gl/maps и mapy.com/s/ разворачиваются HEAD
// через прокси клона; итоговый адрес ответа — адрес прокси, из него снимается префикс прокси.

export interface LinkSources {
    fetch: typeof fetch;
    corsProxyUrl: string;
}

// makeSearchResult старого: зум больше 18 старого клиента обрезается
const MAX_ZOOM = 18;

class InvalidLink extends Error {}

function result(lat: number, lng: number, zoom: number, title: string): SearchResult {
    if (
        [zoom, lat, lng].some(Number.isNaN) ||
        zoom < 0 ||
        zoom > 25 ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
    ) {
        throw new InvalidLink('Invalid view state value');
    }
    return {
        title,
        subtitle: null,
        latlng: { lat, lng },
        bounds: null,
        zoom: fromLeafletZoom(Math.min(zoom, MAX_ZOOM)),
    };
}

const malformed = (name: string) => ({ error: `Invalid coordinates in ${name} link` });
const brokenShort = (name: string) => ({ error: `Broken ${name} short link` });
// не ссылка на карту: строка поиска предложит открыть её как файл трека (design search-track-links)
export const UNSUPPORTED_LINK = 'Unsupported link';
const UNSUPPORTED = { error: UNSUPPORTED_LINK };

// адрес прокси «<прокси>/https/host/path?q» → «https://host/path?q»; прочие адреса — как есть
function unproxy(url: string, corsProxyUrl: string): URL {
    if (!url.startsWith(corsProxyUrl)) {
        return new URL(url);
    }
    return new URL(url.slice(corsProxyUrl.length).replace(/^(https?)\//u, '$1://'));
}

function viaProxy(url: URL, corsProxyUrl: string): string {
    return corsProxyUrl + url.href.replace(/^(https?):\/\//u, '$1/');
}

// HEAD через прокси; браузер идёт по редиректам прокси сам, итоговый адрес — response.url
async function resolveShort(url: URL, sources: LinkSources): Promise<URL> {
    const response = await sources.fetch(viaProxy(url, sources.corsProxyUrl), { method: 'HEAD' });
    return unproxy(response.url || viaProxy(url, sources.corsProxyUrl), sources.corsProxyUrl);
}

function yandex(url: URL): SearchResponse {
    try {
        const [lng, lat] = (url.searchParams.get('ll') ?? '').split(',').map(Number.parseFloat);
        const zoom = Math.round(Number.parseFloat(url.searchParams.get('z') ?? ''));
        return { results: [result(lat, lng, zoom, 'Yandex map view')] };
    } catch {
        return malformed('Yandex');
    }
}

const GOOGLE_VIEW = /\/@([-\d.]+),([-\d.]+),(?:([\d.]+)([mz]))?/u;
const GOOGLE_PLACE = /\/place\/([^/]+)/u;
const GOOGLE_PLACE_ZOOM = 14;
const GOOGLE_PANORAMA_ZOOM = 16;

// /maps/place/<название>/@вид/data=…!8m2!3d<lat>!4d<lng>: место и вид — два результата
function googleSimple(url: URL): SearchResult[] {
    const results: SearchResult[] = [];
    const path = url.pathname;
    const place = path.match(GOOGLE_PLACE);
    const placeCoordinates = path.match(/\/data=[^/]*!8m2!3d([-\d.]+)!4d([-\d.]+)/u);
    if (place && placeCoordinates) {
        try {
            const title = `Google map - ${decodeURIComponent(place[1]).replace(/\+/gu, ' ')}`;
            results.push(
                result(
                    Number.parseFloat(placeCoordinates[1]),
                    Number.parseFloat(placeCoordinates[2]),
                    GOOGLE_PLACE_ZOOM,
                    title,
                ),
            );
        } catch {
            // место без годных координат — только вид
        }
    }
    const view = path.match(GOOGLE_VIEW);
    if (view) {
        try {
            const lat = Number.parseFloat(view[1]);
            const lng = Number.parseFloat(view[2]);
            let zoom: number;
            if (view[3] === undefined) {
                zoom = GOOGLE_PANORAMA_ZOOM;
            } else {
                zoom = Number.parseFloat(view[3]);
                // у спутника масштаб — метры на экран, а не зум
                if (view[4] === 'm') {
                    zoom = Math.log2((149175296 / zoom) * Math.cos((lat / 180) * Math.PI));
                }
                zoom = Math.round(zoom);
            }
            results.push(result(lat, lng, zoom, 'Google map view'));
        } catch {
            // негодный вид
        }
    }
    if (!results.length) {
        throw new InvalidLink('No results extracted from Google link');
    }
    return results;
}

// ?q=lat,lng или ?q=loc:lat,lng
function googleQuery(url: URL): SearchResult[] {
    const m = (url.searchParams.get('q') ?? '').match(/^(?:loc:)?([-\d.]+),([-\d.]+)$/u);
    if (!m) {
        throw new InvalidLink('No coordinates in Google query');
    }
    return [result(Number.parseFloat(m[1]), Number.parseFloat(m[2]), 17, 'Google map view')];
}

// Google отправляет запросы с IP прокси (Cloudflare Workers) на капчу www.google.com/sorry/ с ответом 429, а исходный
// адрес кладёт в параметр continue. Капчу не проходим: адрес с координатами берём оттуда (resolveGoogleShortUrl
// старого клиента)
function unsorry(url: URL): URL {
    const target = url.searchParams.get('continue');
    if (/^www\.google\.[a-z.]+$/u.test(url.hostname) && url.pathname.startsWith('/sorry/') && target) {
        return new URL(target);
    }
    return url;
}

async function google(url: URL, sources: LinkSources): Promise<SearchResponse> {
    const short = url.hostname === 'goo.gl';
    let actual: URL | null = url;
    if (short) {
        try {
            actual = unsorry(await resolveShort(url, sources));
        } catch {
            actual = null;
        }
    }
    // разборщики по очереди, как subprocessors старого: негодный вид с ?q= ещё разбирается как запрос
    const parsers: [(url: URL) => boolean, (url: URL) => SearchResult[]][] = [
        [(u) => GOOGLE_VIEW.test(u.pathname) || GOOGLE_PLACE.test(u.pathname), googleSimple],
        [(u) => u.searchParams.has('q'), googleQuery],
    ];
    for (const [ours, parse] of parsers) {
        if (actual && ours(actual)) {
            try {
                return { results: parse(actual) };
            } catch {
                // следующий разборщик
            }
        }
    }
    return short ? brokenShort('Google') : malformed('Google');
}

async function mapy(url: URL, sources: LinkSources): Promise<SearchResponse> {
    const short = url.pathname.startsWith('/s/');
    try {
        let actual = url;
        if (short) {
            // языковой поддомен Seznam сломал после перехода на mapy.com — его убираем (как старый клиент)
            const bare = new URL(url.href);
            bare.host = bare.host.replace(/^[a-z]{2}\./u, '');
            actual = await resolveShort(bare, sources);
        }
        const lng = Number.parseFloat(actual.searchParams.get('x') ?? '');
        const lat = Number.parseFloat(actual.searchParams.get('y') ?? '');
        const zoom = Math.round(Number.parseFloat(actual.searchParams.get('z') ?? ''));
        return { results: [result(lat, lng, zoom, 'Mapy.com view')] };
    } catch {
        return short ? brokenShort('Mapy.com') : malformed('Mapy.com');
    }
}

function openStreetMap(url: URL): SearchResponse {
    // без map= во фрагменте — не вид (прямая ссылка на GPX трека OSM): строка поиска предложит открыть как файл
    if (!/\bmap=/u.test(url.hash)) {
        return UNSUPPORTED;
    }
    const m = url.hash.match(/map=([\d.]+)\/([\d.-]+)\/([\d.-]+)/u);
    try {
        if (!m) {
            throw new InvalidLink('no map=');
        }
        const zoom = Math.round(Number.parseFloat(m[1]));
        return { results: [result(Number.parseFloat(m[2]), Number.parseFloat(m[3]), zoom, 'OpenStreetMap view')] };
    } catch {
        return malformed('OpenStreetMap');
    }
}

function nakarte(url: URL): SearchResponse {
    const m = url.hash.match(/\bm=([\d]+)\/([\d.-]+)\/([\d.-]+)/u);
    try {
        if (!m) {
            throw new InvalidLink('no m=');
        }
        const zoom = Math.round(Number.parseFloat(m[1]));
        return { results: [result(Number.parseFloat(m[2]), Number.parseFloat(m[3]), zoom, 'Nakarte view')] };
    } catch {
        return malformed('Nakarte');
    }
}

// track:// — ссылка на трек, её понимало поле Track URL (design search-track-links)
export function isLinkQuery(query: string): boolean {
    return /^(https?|track):\/\//u.test(query);
}

export async function searchLink(query: string, sources: LinkSources): Promise<SearchResponse> {
    let url: URL;
    try {
        url = new URL(query);
    } catch {
        return { error: 'Invalid link' };
    }
    const host = url.hostname;
    if ((/\byandex\./u.test(host) && url.pathname.startsWith('/maps/')) || /static-maps\.yandex\./u.test(host)) {
        return yandex(url);
    }
    if ((/\bgoogle\./u.test(host) || host === 'goo.gl') && /^\/maps(\/|$)/u.test(url.pathname)) {
        return google(url, sources);
    }
    if (/\bmapy\.(cz|com)$/u.test(host)) {
        return mapy(url, sources);
    }
    if (/\bopenstreetmap\./u.test(host)) {
        return openStreetMap(url);
    }
    // любой адрес с годным m= — ссылка nakarte (isOurUrl старого: хост nakarte или разбор без ошибки)
    const view = nakarte(url);
    if (/\bnakarte\b/u.test(host) || !('error' in view)) {
        return view;
    }
    return UNSUPPORTED;
}
