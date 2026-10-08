import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const SOURCE_URL = 'https://brouter.de/brouter/segments4/';
const LOOKUPS_URL = 'https://brouter.de/brouter/profiles2/lookups.dat';
const BUCKET = process.env.R2_BUCKET ?? 'nakarte-tiles';
const MODE = process.env.R2_MODE === 'remote' ? '--remote' : '--local';
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const MANIFEST_KEY = 'manifest.json';
const MANIFEST_SAVE_EVERY = 20;
// Точную версию задаёт workflow (переменная WRANGLER), локально хватает последней 4.x.
const WRANGLER = process.env.WRANGLER ?? 'wrangler@4';
const INDEX_ROW = /<a href="([^"]+\.rd5)">[^<]*<\/a>\s+(\S+ \S+)\s+(\d+)/gu;

function wrangler(args, {capture = false} = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn('npx', ['--yes', WRANGLER, 'r2', 'object', ...args, MODE], {
            stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
        });
        const chunks = [];
        child.stdout?.on('data', (chunk) => chunks.push(chunk));
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`wrangler ${args.slice(0, 2).join(' ')} exited with ${code}`));
                return;
            }
            resolve(Buffer.concat(chunks).toString());
        });
    });
}

async function readManifest() {
    try {
        return JSON.parse(await wrangler(['get', `${BUCKET}/${MANIFEST_KEY}`, '--pipe'], {capture: true}));
    } catch {
        return {lookupsSha256: null, tiles: {}};
    }
}

async function writeManifest(manifest, dir) {
    const path = join(dir, MANIFEST_KEY);
    await pipeline(Readable.from([JSON.stringify(manifest, null, 1)]), createWriteStream(path));
    await wrangler(['put', `${BUCKET}/${MANIFEST_KEY}`, '--file', path, '--content-type', 'application/json']);
}

async function fetchIndex() {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) {
        throw new Error(`${SOURCE_URL}: ${response.status}`);
    }
    const html = await response.text();
    return [...html.matchAll(INDEX_ROW)].map(([, name, modified, size]) => ({
        name,
        size: Number(size),
        version: `${modified} ${size}`,
    }));
}

async function lookupsSha256() {
    const response = await fetch(LOOKUPS_URL);
    if (!response.ok) {
        throw new Error(`${LOOKUPS_URL}: ${response.status}`);
    }
    return createHash('sha256')
        .update(Buffer.from(await response.arrayBuffer()))
        .digest('hex');
}

async function syncTile(tile, dir) {
    const path = join(dir, tile.name);
    const response = await fetch(SOURCE_URL + tile.name);
    if (!response.ok) {
        throw new Error(`${tile.name}: ${response.status}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
    const {size} = await stat(path);
    if (size !== tile.size) {
        throw new Error(`${tile.name}: expected ${tile.size} bytes, got ${size}`);
    }
    await wrangler(['put', `${BUCKET}/${tile.name}`, '--file', path, '--content-type', 'application/octet-stream']);
    await rm(path);
}

async function main() {
    const dir = await mkdtemp(join(tmpdir(), 'brouter-tiles-'));
    const manifest = await readManifest();

    const sha = await lookupsSha256();
    if (manifest.lookupsSha256 && manifest.lookupsSha256 !== sha) {
        const hint = 'update engine profiles first, then reset lookupsSha256 in the manifest';
        throw new Error(`lookups.dat on brouter.de changed: ${hint}`);
    }
    manifest.lookupsSha256 = sha;

    const index = await fetchIndex();
    const pending = index
        .filter((tile) => !ONLY.length || ONLY.includes(tile.name.replace(/\.rd5$/u, '')))
        .filter((tile) => manifest.tiles[tile.name] !== tile.version);
    console.log(`index: ${index.length} tiles, to sync: ${pending.length}`); // eslint-disable-line no-console

    let done = 0;
    const failures = [];
    async function worker() {
        for (let tile = pending.shift(); tile; tile = pending.shift()) {
            try {
                await syncTile(tile, dir);
                manifest.tiles[tile.name] = tile.version;
                done += 1;
                console.log(`synced ${tile.name} (${done})`); // eslint-disable-line no-console
                if (done % MANIFEST_SAVE_EVERY === 0) {
                    await writeManifest(manifest, dir);
                }
            } catch (e) {
                failures.push(`${tile.name}: ${e.message}`);
            }
        }
    }
    await Promise.all(Array.from({length: CONCURRENCY}, worker));
    await writeManifest(manifest, dir);
    await rm(dir, {recursive: true});

    if (failures.length) {
        throw new Error(`failed to sync ${failures.length} tiles:\n${failures.join('\n')}`);
    }
}

main().catch((e) => {
    console.error(e.message); // eslint-disable-line no-console
    process.exit(1);
});
