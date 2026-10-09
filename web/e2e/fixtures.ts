import { fileURLToPath } from 'node:url';
import { type BrowserContext, test as base, expect } from '@playwright/test';
import { makeConfig } from '../src/config.ts';
import { buildCatalog } from '../src/layers/catalog.ts';
import { COVERAGE_CODE, COVERAGE_TILES } from '../src/streetview/coverage.ts';

const TILE_FIXTURE = fileURLToPath(new URL('../src/test/tile.png', import.meta.url));
// сохранённые ответы поисковиков (src/search/fixtures/, 2026-10-09)
const MAPYCZ_FIXTURE = fileURLToPath(new URL('../src/search/fixtures/mapycz-mtatsminda.json', import.meta.url));
const PHOTON_FIXTURE = fileURLToPath(new URL('../src/search/fixtures/photon-mtatsminda.json', import.meta.url));
// адреса прокси и хранилища треков клона — те же, что в сборке (vite build --mode clone)
export const CORS_PROXY_URL = makeConfig('clone').corsProxyUrl;
export const TRACKS_STORAGE = makeConfig('clone').tracksStorageServer;
// сервис высот клона: в тестах отвечает заглушка, высота — функция широты (elevationAt)
export const ELEVATION_SERVER = makeConfig('clone').elevationsServer;
export const elevationAt = (lat: number) => Math.round((lat - 41.6) * 10000 * 100) / 100;
// сервер своего слоя в тестах: выдуманный хост, ответы — фикстура
export const CUSTOM_TILE_HOST = 'tiles.example.test';
// загрузчик рантайма CheerpJ клона (CDN Leaning Technologies)
export const CHEERPJ_LOADER = makeConfig('clone').routingEngineRuntimeUrl;

// Заглушка рантайма CheerpJ вместо настоящего с CDN (design add-web-route-editor, «Тесты»): те же глобальные
// cheerpjInit и cheerpjRunLibrary, а WasmRouter.route отвечает GeoJSON без расчёта — прямая с изломом далеко в сторону
// (так проложенный отрезок заметно длиннее прямой). Отрезок, конец которого севернее NO_ROUTE_LAT, падает исключением
// «Java» с текстом BRouter про отсутствующий тайл. Воркер движка, его протокол и очередь при этом настоящие.
//
// Запросы importScripts из воркера context.route Playwright перехватывает не всегда: воркер успевает сходить в сеть до
// того, как к нему подключился перехват, и тогда грузится настоящий рантайм с CDN (проверено 2026-10-09: cj3.wasm,
// 11/lib/modules). Поэтому подменяется сам скрипт воркера — его запрашивает страница: перед кодом воркера встаёт
// importScripts, который вместо загрузчика CheerpJ выполняет заглушку и в сеть не ходит. Адрес CDN тоже отвечает
// заглушкой — для запасного пути на главном потоке.
export const NO_ROUTE_LAT = 41.692;
const FAKE_CHEERPJ = `
self.cheerpjInit = async () => {};
self.cheerpjRunLibrary = async () => ({
    WasmRouter: Promise.resolve({
        async route(segmentDir, profileDir, query) {
            const [from, to] = new URLSearchParams(query).get('lonlats').split('|').map((p) => p.split(',').map(Number));
            if (from[1] > ${NO_ROUTE_LAT} || to[1] > ${NO_ROUTE_LAT}) {
                throw { getMessage: async () => 'datafile E40_N45.rd5 not found' };
            }
            const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.01];
            return JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [from, middle, to] } }] });
        },
    }),
});
`;
const WORKER_PRELUDE = `
(() => {
    const realImportScripts = self.importScripts.bind(self);
    self.importScripts = (...urls) => {
        for (const url of urls) {
            if (url === ${JSON.stringify(CHEERPJ_LOADER)}) {
                ${FAKE_CHEERPJ}
            } else {
                realImportScripts(url);
            }
        }
    };
})();
`;
const ENGINE_WORKER = /\/assets\/engine\.worker-[^/]+\.js$/;

// Заглушка Maps JavaScript API (design add-web-search-panoramas, «Тесты»): те же глобальные google.maps, что зовёт
// src/streetview/google.ts, без сети. Панорамы — в точках STREET_VIEW_PANORAMAS, ближайшая в радиусе; окно — div
// google-panorama с видом в data-view. Колбэк загрузки — из параметра callback адреса скрипта.
export const GOOGLE_MAPS_API = 'https://maps.googleapis.com/maps/api/js';
export const STREET_VIEW_PANORAMAS = [
    { lat: 41.693, lng: 44.78 },
    { lat: 41.6935, lng: 44.781 },
];
const FAKE_GOOGLE_MAPS = `
(() => {
    const panoramas = ${JSON.stringify(STREET_VIEW_PANORAMAS)};
    class LatLng {
        constructor(lat, lng) { this.a = lat; this.b = lng; }
        lat() { return this.a; }
        lng() { return this.b; }
    }
    class StreetViewPanorama {
        constructor(container) {
            this.listeners = {};
            this.position = null;
            this.pov = { heading: 0, pitch: 0 };
            this.zoom = 1;
            this.element = document.createElement('div');
            this.element.dataset.testid = 'google-panorama';
            container.append(this.element);
            window.__panorama = this;
        }
        addListener(event, handler) { (this.listeners[event] ||= []).push(handler); }
        fire(event) { for (const handler of this.listeners[event] || []) handler(); }
        render() {
            const p = this.position;
            this.element.dataset.view = p ? p.lat.toFixed(5) + ',' + p.lng.toFixed(5) + ',' + this.pov.heading : '';
        }
        getPosition() { return this.position && new LatLng(this.position.lat, this.position.lng); }
        setPosition(position) { this.position = position; this.render(); this.fire('position_changed'); }
        getPov() { return this.pov; }
        setPov(pov) { this.pov = pov; this.render(); this.fire('pov_changed'); }
        getZoom() { return this.zoom; }
        setZoom(zoom) { this.zoom = zoom; }
        setVisible() {}
    }
    class StreetViewService {
        getPanorama(request, callback) {
            const { lat, lng } = request.location;
            const meters = (p) => Math.hypot(p.lat - lat, (p.lng - lng) * Math.cos((lat * Math.PI) / 180)) * 111320;
            const nearest = panoramas.slice().sort((a, b) => meters(a) - meters(b))[0];
            const found = nearest && meters(nearest) <= request.radius;
            setTimeout(() => callback(found ? { location: { latLng: new LatLng(nearest.lat, nearest.lng) } } : null, found ? 'OK' : 'ZERO_RESULTS'));
        }
    }
    window.google = { maps: {
        StreetViewPanorama,
        StreetViewService,
        StreetViewPreference: { NEAREST: 'nearest' },
        StreetViewStatus: { OK: 'OK' },
        event: { trigger() {}, clearInstanceListeners() {} },
    } };
    const callback = new URL(document.currentScript.src).searchParams.get('callback');
    window[callback]();
})();
`;

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Шаблон адреса тайла → регулярка: токены MapLibre — числа и квадключ, {ratio} — необязательный @2x, язык
// подписей Google — любой (в браузере теста navigator.language свой)
function templateToRegExp(template: string) {
    const pattern = escapeRegExp(template)
        .replace(/\\\{[zxy]\\\}/g, '\\d+')
        .replace(/\\\{quadkey\\\}/g, '[0-3]*')
        .replace(/\\\{ratio\\\}/g, '(?:@2x)?')
        .replace(/hl=LANG/g, 'hl=[^&]*');
    return new RegExp(`^${pattern}$`);
}

// Каталог тем же модулем, что приложение: и обычный, и retina (адреса Strava отличаются px=)
const LAYER_TILES: [code: string, pattern: RegExp][] = [1, 2].flatMap((pixelRatio) =>
    buildCatalog({ pixelRatio, language: 'LANG', corsProxyUrl: CORS_PROXY_URL }).flatMap((layer) =>
        (layer.source.tiles ?? []).map((template): [string, RegExp] => [layer.code, templateToRegExp(template)]),
    ),
);
LAYER_TILES.push([COVERAGE_CODE, templateToRegExp(COVERAGE_TILES)]);
const CUSTOM_TILE = new RegExp(`^https://${escapeRegExp(CUSTOM_TILE_HOST)}/`);
const PROXIED_CUSTOM_TILE = new RegExp(`^${escapeRegExp(CORS_PROXY_URL)}https/${escapeRegExp(CUSTOM_TILE_HOST)}/`);

interface Network {
    // запрошенные тайлы: код слоя (или 'custom') и адрес
    tiles: { code: string; url: string }[];
    // запросы мимо localhost и подменённых тайлов: тест обязан закончиться с пустым списком
    external: string[];
    // внешние запросы по-прежнему обрываются, но тест не валят: старые ссылки несут свои слои на чужих серверах
    // и ссылки на файлы треков, ответы на которые тесту не нужны
    allowExternal(): void;
    // адреса тайлов слоя
    tilesOf(code: string): string[];
    // ответить ошибкой 503 на тайлы слоя
    failTiles(code: string): void;
    // сервер своего слоя отвечает без CORS (как многие частные серверы тайлов)
    customWithoutCors(): void;
    // хранилище треков (POST/GET /track/{key}) в памяти: ключ → тело
    storage: Map<string, string>;
    // тела запросов к сервису высот (POST строк «lat lng»); ответ — elevationAt по широте
    elevationRequests: string[];
    // ответ прокси клона на адрес (импорт по ссылке): файл фикстуры или статус
    proxyResponds(url: string, response: { path?: string; body?: string; status?: number }): void;
    // сколько раз запущен воркер движка с заглушкой CheerpJ (или отдана заглушка загрузчика главному потоку)
    engineLoads: number;
    // запросы к CDN CheerpJ, которые увидел браузер: с заглушкой их быть не должно
    cdnRequests: string[];
    // та же сеть для другого контекста браузера (другой пользователь со своим IndexedDB, но общим хранилищем треков)
    attach(context: BrowserContext): Promise<void>;
    // запросы поиска: mapy.cz через прокси и photon — сохранёнными ответами или заданным статусом
    searchRequests: string[];
    searchResponds(service: 'mapycz' | 'photon', response: { status: number }): void;
    // адреса загрузки Maps JavaScript API (заглушка FAKE_GOOGLE_MAPS)
    googleApiLoads: string[];
}

// Сеть теста: localhost — как есть, хранилище треков — в памяти, сервис высот — заглушка, прокси — заданные ответы, тайлы слоёв каталога и
// своего слоя — фикстура с CORS (или ошибка), всё остальное обрывается и валит тест в конце. Так e2e не ходит к
// провайдерам и сервисам и ловит лишние внешние запросы.
// auto: фикстура Playwright ленивая, и тест, который не просит network в аргументах, иначе шёл бы без перехвата —
// в настоящую сеть (так было до 2026-10-09 у тестов вида `async ({ page }) =>`)
export const test = base.extend<{ network: Network }>({
    network: [
        async ({ context }, use) => {
            const failing = new Set<string>();
            let customCors = true;
            let externalAllowed = false;
            const proxied = new Map<string, { path?: string; body?: string; status?: number }>();
            const searchStatus: Record<'mapycz' | 'photon', number> = { mapycz: 200, photon: 200 };
            const network: Network = {
                searchRequests: [],
                searchResponds: (service, response) => {
                    searchStatus[service] = response.status;
                },
                googleApiLoads: [],
                engineLoads: 0,
                cdnRequests: [],
                storage: new Map(),
                elevationRequests: [],
                proxyResponds: (url, response) => {
                    proxied.set(CORS_PROXY_URL + url.replace(/^(https?):\/\//, '$1/'), response);
                },
                tiles: [],
                external: [],
                tilesOf: (code) => network.tiles.filter((tile) => tile.code === code).map((tile) => tile.url),
                failTiles: (code) => {
                    failing.add(code);
                },
                customWithoutCors: () => {
                    customCors = false;
                },
                allowExternal: () => {
                    externalAllowed = true;
                },
                attach: async (other) => {
                    await intercept(other);
                },
            };
            async function intercept(target: BrowserContext) {
                target.on('request', (request) => {
                    if (new URL(request.url()).hostname.endsWith('leaningtech.com')) {
                        network.cdnRequests.push(request.url());
                    }
                });
                await target.route('**/*', async (route) => {
                    const url = route.request().url();
                    if (new URL(url).hostname === 'localhost') {
                        if (ENGINE_WORKER.test(new URL(url).pathname)) {
                            network.engineLoads += 1;
                            const response = await route.fetch();
                            return route.fulfill({ response, body: WORKER_PRELUDE + (await response.text()) });
                        }
                        return route.continue();
                    }
                    // CORS отражённым Origin, как у Worker'ов клона (route.fulfill браузер на CORS не проверяет, но пусть
                    // ответ будет как настоящий)
                    // загрузчик — до чтения заголовков: importScripts воркера идёт без CORS, а headerValue ждёт сырые заголовки
                    if (url === CHEERPJ_LOADER) {
                        network.engineLoads += 1;
                        return route.fulfill({ status: 200, body: FAKE_CHEERPJ, contentType: 'text/javascript' });
                    }
                    const cors = {
                        'Access-Control-Allow-Origin': (await route.request().headerValue('origin')) ?? '*',
                    };
                    if (url.startsWith(GOOGLE_MAPS_API)) {
                        network.googleApiLoads.push(url);
                        return route.fulfill({ status: 200, body: FAKE_GOOGLE_MAPS, contentType: 'text/javascript' });
                    }
                    const searchService = url.startsWith(`${CORS_PROXY_URL}https/pro.mapy.cz/suggest/`)
                        ? 'mapycz'
                        : url.startsWith('https://photon.komoot.io/api/')
                          ? 'photon'
                          : null;
                    if (searchService) {
                        network.searchRequests.push(url);
                        const status = searchStatus[searchService];
                        return status === 200
                            ? route.fulfill({
                                  status,
                                  path: searchService === 'mapycz' ? MAPYCZ_FIXTURE : PHOTON_FIXTURE,
                                  contentType: 'application/json',
                                  headers: cors,
                              })
                            : route.fulfill({ status, body: 'error', headers: cors });
                    }
                    if (url.startsWith(`${TRACKS_STORAGE}/track/`)) {
                        const key = url.slice(`${TRACKS_STORAGE}/track/`.length);
                        if (route.request().method() === 'POST') {
                            network.storage.set(key, route.request().postData() ?? '');
                            return route.fulfill({ status: 200, body: '', headers: cors });
                        }
                        const body = network.storage.get(key);
                        return body === undefined
                            ? route.fulfill({ status: 404, body: 'not found', headers: cors })
                            : route.fulfill({ status: 200, body, contentType: 'text/plain', headers: cors });
                    }
                    if (url === ELEVATION_SERVER && route.request().method() === 'POST') {
                        const body = route.request().postData() ?? '';
                        network.elevationRequests.push(body);
                        const rows = body.split('\n').map((row) => elevationAt(Number.parseFloat(row)).toFixed(2));
                        return route.fulfill({
                            status: 200,
                            body: rows.join('\n'),
                            contentType: 'text/plain',
                            headers: cors,
                        });
                    }
                    const proxiedResponse = proxied.get(url);
                    if (proxiedResponse) {
                        return route.fulfill({
                            status: proxiedResponse.status ?? 200,
                            ...proxiedResponse,
                            headers: cors,
                        });
                    }
                    const proxiedCustom = PROXIED_CUSTOM_TILE.test(url);
                    const custom = !proxiedCustom && CUSTOM_TILE.test(url);
                    const code =
                        proxiedCustom || custom ? 'custom' : LAYER_TILES.find(([, pattern]) => pattern.test(url))?.[0];
                    if (!code) {
                        if (!externalAllowed) {
                            network.external.push(url);
                        }
                        return route.abort();
                    }
                    network.tiles.push({ code, url });
                    // Сервер без CORS: на ответ route.fulfill браузер CORS не проверяет, поэтому CORS-запрос (fetch с
                    // mode: 'cors', тайл MapLibre) обрывается — для страницы это та же TypeError, что и отказ CORS;
                    // no-cors запрос получает ответ. Отличаем по Origin: Chromium шлёт его только в CORS-запросе
                    // (Sec-Fetch-Mode перехват Playwright не показывает)
                    if (custom && !customCors && (await route.request().headerValue('origin'))) {
                        return route.abort();
                    }
                    // WebGL берёт растр только с CORS: подменённый ответ несёт заголовок, как настоящие серверы слоёв
                    if (failing.has(code)) {
                        return route.fulfill({ status: 503, body: 'unavailable', headers: cors });
                    }
                    return route.fulfill({ path: TILE_FIXTURE, contentType: 'image/png', headers: cors });
                });
            }
            await intercept(context);
            await use(network);
            expect(network.external, 'запросы мимо localhost и подменённых тайлов').toEqual([]);
            expect(network.cdnRequests, 'запросы к CDN CheerpJ мимо заглушки').toEqual([]);
        },
        { auto: true },
    ],
});

export { expect };
