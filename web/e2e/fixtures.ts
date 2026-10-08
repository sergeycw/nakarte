import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

const TILE_FIXTURE = fileURLToPath(new URL('../src/test/tile.png', import.meta.url));
const OSM_TILE = /^https:\/\/tile\.openstreetmap\.org\/(\d+)\/(\d+)\/(\d+)\.png$/;

interface Network {
    // тайлы OSM, которые запросила карта, в виде z/x/y
    osmTiles: string[];
    // запросы мимо localhost и подменённых тайлов: тест обязан закончиться с пустым списком
    external: string[];
    // ответить ошибкой на все тайлы OSM
    failOsmTiles: () => void;
}

// Сеть теста: localhost — как есть, тайлы OSM — фикстура (или ошибка), всё остальное обрывается и
// валит тест в конце. Так e2e не зависит от tile.openstreetmap.org и ловит лишние внешние запросы.
export const test = base.extend<{ network: Network }>({
    network: async ({ context }, use) => {
        let failTiles = false;
        const network: Network = {
            osmTiles: [],
            external: [],
            failOsmTiles: () => {
                failTiles = true;
            },
        };
        await context.route('**/*', async (route) => {
            const url = route.request().url();
            if (new URL(url).hostname === 'localhost') {
                return route.continue();
            }
            const tile = url.match(OSM_TILE);
            if (!tile) {
                network.external.push(url);
                return route.abort();
            }
            network.osmTiles.push(`${tile[1]}/${tile[2]}/${tile[3]}`);
            if (failTiles) {
                return route.fulfill({ status: 503, body: 'unavailable' });
            }
            return route.fulfill({ path: TILE_FIXTURE, contentType: 'image/png' });
        });
        await use(network);
        expect(network.external, 'запросы мимо localhost и тайлов OSM').toEqual([]);
    },
});

export { expect };
