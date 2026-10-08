import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { makeConfig } from '../src/config.ts';
import { buildCatalog } from '../src/layers/catalog.ts';

const TILE_FIXTURE = fileURLToPath(new URL('../src/test/tile.png', import.meta.url));
// адреса прокси и хранилища треков клона — те же, что в сборке (vite build --mode clone)
export const CORS_PROXY_URL = makeConfig('clone').corsProxyUrl;
export const TRACKS_STORAGE = makeConfig('clone').tracksStorageServer;
// сервер своего слоя в тестах: выдуманный хост, ответы — фикстура
export const CUSTOM_TILE_HOST = 'tiles.example.test';

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
const CUSTOM_TILE = new RegExp(`^https://${escapeRegExp(CUSTOM_TILE_HOST)}/`);
const PROXIED_CUSTOM_TILE = new RegExp(`^${escapeRegExp(CORS_PROXY_URL)}https/${escapeRegExp(CUSTOM_TILE_HOST)}/`);

interface Network {
    // запрошенные тайлы: код слоя (или 'custom') и адрес
    tiles: { code: string; url: string }[];
    // запросы мимо localhost и подменённых тайлов: тест обязан закончиться с пустым списком
    external: string[];
    // адреса тайлов слоя
    tilesOf(code: string): string[];
    // ответить ошибкой 503 на тайлы слоя
    failTiles(code: string): void;
    // сервер своего слоя отвечает без CORS (как многие частные серверы тайлов)
    customWithoutCors(): void;
    // хранилище треков (POST/GET /track/{key}) в памяти: ключ → тело
    storage: Map<string, string>;
    // ответ прокси клона на адрес (импорт по ссылке): файл фикстуры или статус
    proxyResponds(url: string, response: { path?: string; body?: string; status?: number }): void;
}

// Сеть теста: localhost — как есть, хранилище треков — в памяти, прокси — заданные ответы, тайлы слоёв каталога и
// своего слоя — фикстура с CORS (или ошибка), всё остальное обрывается и валит тест в конце. Так e2e не ходит к
// провайдерам и сервисам и ловит лишние внешние запросы.
export const test = base.extend<{ network: Network }>({
    network: async ({ context }, use) => {
        const failing = new Set<string>();
        let customCors = true;
        const proxied = new Map<string, { path?: string; body?: string; status?: number }>();
        const network: Network = {
            storage: new Map(),
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
        };
        await context.route('**/*', async (route) => {
            const url = route.request().url();
            if (new URL(url).hostname === 'localhost') {
                return route.continue();
            }
            // CORS отражённым Origin, как у Worker'ов клона (route.fulfill браузер на CORS не проверяет, но пусть
            // ответ будет как настоящий)
            const cors = { 'Access-Control-Allow-Origin': (await route.request().headerValue('origin')) ?? '*' };
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
            const proxiedResponse = proxied.get(url);
            if (proxiedResponse) {
                return route.fulfill({ status: proxiedResponse.status ?? 200, ...proxiedResponse, headers: cors });
            }
            const proxiedCustom = PROXIED_CUSTOM_TILE.test(url);
            const custom = !proxiedCustom && CUSTOM_TILE.test(url);
            const code = proxiedCustom || custom ? 'custom' : LAYER_TILES.find(([, pattern]) => pattern.test(url))?.[0];
            if (!code) {
                network.external.push(url);
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
        await use(network);
        expect(network.external, 'запросы мимо localhost и подменённых тайлов').toEqual([]);
    },
});

export { expect };
