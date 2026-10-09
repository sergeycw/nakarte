import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const SOURCE_URL = 'https://brouter.de/brouter/segments4/';
const LOOKUPS_URL = 'https://brouter.de/brouter/profiles2/lookups.dat';
const BUCKET = process.env.R2_BUCKET ?? 'nakarte-tiles';
const REMOTE = process.env.R2_MODE === 'remote';
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const MANIFEST_KEY = 'manifest.json';
const MANIFEST_SAVE_EVERY = 20;
// Локальный R2 (wrangler dev) — только через wrangler; локально хватает последней 4.x.
const WRANGLER = process.env.WRANGLER ?? 'wrangler@4';
const INDEX_ROW = /<a href="([^"]+\.rd5)">[^<]*<\/a>\s+(\S+ \S+)\s+(\d+)/gu;
// S3 API R2 так отвечает на отсутствующий ключ; любая другая ошибка чтения манифеста — не «пустой манифест».
const NO_SUCH_KEY = /NoSuchKey/u;

function run(command, args, {env = process.env, capture = false} = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {env, stdio: ['ignore', capture ? 'pipe' : 'inherit', 'pipe']});
        const out = [];
        const err = [];
        child.stdout?.on('data', (chunk) => out.push(chunk));
        child.stderr.on('data', (chunk) => {
            err.push(chunk);
            process.stderr.write(chunk);
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                const error = new Error(`${command} ${args.slice(0, 2).join(' ')} exited with ${code}`);
                error.stderr = Buffer.concat(err).toString();
                reject(error);
                return;
            }
            resolve(Buffer.concat(out).toString());
        });
    });
}

// Cloudflare — S3 API R2, как заливка высот (workers/elevation/scripts/elevation-data.sh): REST API объектов,
// в который ходит wrangler, не принимает токен с правом на один бакет (change sync-tiles-via-s3).
// Ключи из секретов GitHub часто приходят с переводом строки, а aws CLI тогда собирает битый Authorization.
function awsEnv() {
    return {
        ...process.env,
        AWS_ACCESS_KEY_ID: (process.env.R2_ACCESS_KEY_ID ?? '').replace(/\s/gu, ''),
        AWS_SECRET_ACCESS_KEY: (process.env.R2_SECRET_ACCESS_KEY ?? '').replace(/\s/gu, ''),
        AWS_DEFAULT_REGION: 'auto',
    };
}

function aws(args) {
    return run('aws', [...args, '--endpoint-url', process.env.R2_ENDPOINT], {env: awsEnv()});
}

function wrangler(args, options) {
    return run('npx', ['--yes', WRANGLER, 'r2', 'object', ...args, '--local'], options);
}

async function getObject(key, path) {
    if (REMOTE) {
        await aws(['s3api', 'get-object', '--bucket', BUCKET, '--key', key, path]);
        return;
    }
    const body = await wrangler(['get', `${BUCKET}/${key}`, '--pipe'], {capture: true});
    await pipeline(Readable.from([body]), createWriteStream(path));
}

function putObject(key, path, contentType) {
    if (REMOTE) {
        return aws(['s3', 'cp', path, `s3://${BUCKET}/${key}`, '--content-type', contentType, '--only-show-errors']);
    }
    return wrangler(['put', `${BUCKET}/${key}`, '--file', path, '--content-type', contentType]);
}

async function readManifest(dir) {
    const path = join(dir, MANIFEST_KEY);
    try {
        await getObject(MANIFEST_KEY, path);
    } catch (e) {
        // локальный стенд без манифеста — норма; в Cloudflare пустым считаем только отсутствующий объект
        if (!REMOTE || NO_SUCH_KEY.test(e.stderr ?? '')) {
            return {lookupsSha256: null, tiles: {}};
        }
        throw new Error(`cannot read ${MANIFEST_KEY}, nothing synced: ${e.message}`);
    }
    return JSON.parse(await readFile(path, 'utf8'));
}

async function writeManifest(manifest, dir) {
    const path = join(dir, MANIFEST_KEY);
    await pipeline(Readable.from([JSON.stringify(manifest, null, 1)]), createWriteStream(path));
    await putObject(MANIFEST_KEY, path, 'application/json');
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
    await putObject(tile.name, path, 'application/octet-stream');
    await rm(path);
}

async function main() {
    const dir = await mkdtemp(join(tmpdir(), 'brouter-tiles-'));
    const manifest = await readManifest(dir);

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
    console.log(`index: ${index.length} tiles, to sync: ${pending.length}`);

    let done = 0;
    const failures = [];
    async function worker() {
        for (let tile = pending.shift(); tile; tile = pending.shift()) {
            try {
                await syncTile(tile, dir);
                manifest.tiles[tile.name] = tile.version;
                done += 1;
                console.log(`synced ${tile.name} (${done})`);
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
    console.error(e.message);
    process.exit(1);
});
