import {cloudflareTest} from '@cloudflare/vitest-pool-workers';
import {readFileSync, readdirSync} from 'node:fs';
import {defineConfig} from 'vitest/config';

// Внутри workerd нет файловой системы: прореженные объекты `fixtures/dem3/*` и эталоны
// передаются в тест привязками (объекты — base64), а тест кладёт их в локальный R2 `DEM`.
const fixturesDir = new URL('./fixtures/', import.meta.url);
const demObjects = Object.fromEntries(
    readdirSync(new URL('dem3/', fixturesDir)).map((name) => [
        `dem3/${name}`,
        readFileSync(new URL(`dem3/${name}`, fixturesDir)).toString('base64'),
    ])
);

// Эталонные тайлы автора (`fixtures/tiles/{z}-{x}-{y}.gz`, gzip как есть) — тоже base64.
const authorTiles = Object.fromEntries(
    readdirSync(new URL('tiles/', fixturesDir)).map((name) => [
        name.replace(/\.gz$/u, ''),
        readFileSync(new URL(`tiles/${name}`, fixturesDir)).toString('base64'),
    ])
);

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: {configPath: './wrangler.toml'},
            miniflare: {
                bindings: {
                    FIXTURE_OBJECTS: demObjects,
                    FIXTURE_REFERENCE: readFileSync(new URL('reference.txt', fixturesDir), 'utf8'),
                    FIXTURE_TILES: authorTiles,
                },
            },
        }),
    ],
});
