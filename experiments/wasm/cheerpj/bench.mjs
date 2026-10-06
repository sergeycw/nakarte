import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const playwrightPath = process.env.PLAYWRIGHT_CORE;
if (!playwrightPath) {
    throw new Error('set PLAYWRIGHT_CORE to the playwright-core package directory');
}
const {chromium} = await import(pathToFileURL(join(playwrightPath, 'index.mjs')).href);

const base = process.env.BENCH_URL ?? 'http://127.0.0.1:8767/cheerpj/';
const chromePath = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const query = process.argv[2] ?? 'fs=str&repeat=3';
const label = process.argv[3] ?? 'run';
const reloads = Number(process.argv[4] ?? 1);

function category(url) {
    if (url.includes('leaningtech.com')) {
        return 'runtime';
    }
    if (url.endsWith('.jar')) {
        return 'jar';
    }
    if (url.includes('/segments4/')) {
        return 'tiles';
    }
    if (url.includes('/profiles/')) {
        return 'profiles';
    }
    return 'other';
}

function rendererRssKb(browserPid) {
    const out = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command=']).toString();
    const procs = out
        .trim()
        .split('\n')
        .map((line) => {
            const [, pid, ppid, rss, command] = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);
            return {pid: Number(pid), ppid: Number(ppid), rss: Number(rss), command};
        });
    const descendants = new Set([browserPid]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const p of procs) {
            if (!descendants.has(p.pid) && descendants.has(p.ppid)) {
                descendants.add(p.pid);
                grew = true;
            }
        }
    }
    const renderers = procs.filter((p) => descendants.has(p.pid) && p.command.includes('--type=renderer'));
    return Math.max(0, ...renderers.map((p) => p.rss));
}

async function measure(page, cdp, browserPid, url) {
    const requests = new Map();
    const onRequest = (e) => requests.set(e.requestId, {url: e.request.url, bytes: 0, decodedBytes: 0, fromCache: false});
    const onData = (e) => {
        const r = requests.get(e.requestId);
        if (r) {
            r.decodedBytes += e.dataLength;
        }
    };
    const onCache = (e) => {
        const r = requests.get(e.requestId);
        if (r) {
            r.fromCache = true;
        }
    };
    const onResponse = (e) => {
        const r = requests.get(e.requestId);
        if (r) {
            r.status = e.response.status;
            r.fromCache ||= e.response.fromDiskCache || e.response.fromServiceWorker;
        }
    };
    const onFinished = (e) => {
        const r = requests.get(e.requestId);
        if (r) {
            r.bytes = e.encodedDataLength;
        }
    };
    cdp.on('Network.requestWillBeSent', onRequest);
    cdp.on('Network.requestServedFromCache', onCache);
    cdp.on('Network.responseReceived', onResponse);
    cdp.on('Network.loadingFinished', onFinished);
    cdp.on('Network.dataReceived', onData);

    let peakRssKb = 0;
    const sampler = setInterval(() => {
        peakRssKb = Math.max(peakRssKb, rendererRssKb(browserPid));
    }, 250);

    const start = Date.now();
    await page.goto(url);
    await page.waitForFunction(() => window.__bench?.done, null, {timeout: 20 * 60 * 1000, polling: 500});
    const wallMs = Date.now() - start;
    clearInterval(sampler);
    peakRssKb = Math.max(peakRssKb, rendererRssKb(browserPid));
    const bench = await page.evaluate(() => window.__bench);

    cdp.off('Network.requestWillBeSent', onRequest);
    cdp.off('Network.requestServedFromCache', onCache);
    cdp.off('Network.responseReceived', onResponse);
    cdp.off('Network.loadingFinished', onFinished);
    cdp.off('Network.dataReceived', onData);

    const network = {};
    for (const r of requests.values()) {
        const c = category(r.url);
        const entry = (network[c] ??= {requests: 0, transferBytes: 0, decodedBytes: 0, fromCache: 0});
        entry.requests += 1;
        entry.transferBytes += r.bytes;
        entry.decodedBytes += r.decodedBytes;
        entry.fromCache += r.fromCache ? 1 : 0;
    }
    const runtimeRequests = [...requests.values()]
        .filter((r) => category(r.url) === 'runtime')
        .map(({url: u, bytes, decodedBytes, fromCache}) => ({url: u, bytes, decodedBytes, fromCache}));
    return {url, wallMs, peakRendererRssMb: Math.round(peakRssKb / 1024), network, runtimeRequests, bench};
}

const userDataDir = mkdtempSync(join(tmpdir(), 'cheerpj-bench-'));
const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: chromePath,
    headless: true,
});
const browserPid = Number(
    execFileSync('pgrep', ['-f', `user-data-dir=${userDataDir}`])
        .toString()
        .trim()
        .split('\n')
        .map(Number)
        .find((pid) => {
            const cmd = execFileSync('ps', ['-o', 'command=', '-p', String(pid)]).toString();
            return !cmd.includes('--type=');
        })
);
const page = await context.newPage();
page.on('console', (msg) => {
    if (msg.text().startsWith('[bench]')) {
        console.log(msg.text());
    }
});
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');

const runs = [];
for (let i = 0; i <= reloads; i++) {
    const kind = i === 0 ? 'cold' : `warm${i}`;
    console.log(`--- ${kind} ${query}`);
    const result = await measure(page, cdp, browserPid, `${base}?${query}`);
    runs.push({kind, ...result});
    console.log(JSON.stringify({kind, wallMs: result.wallMs, rss: result.peakRendererRssMb, network: result.network}));
}
await context.close();

mkdirSync(join(here, 'results'), {recursive: true});
const file = join(here, 'results', `${label}.json`);
writeFileSync(file, JSON.stringify({chrome: chromePath, query, runs}, null, 2) + '\n');
console.log(`saved ${file}`);
