import {createReadStream, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {dirname, extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8767);
const delayMs = Number(process.env.DELAY_MS ?? 0);
const crossOriginIsolated = process.env.COI === '1';
const runtimeProxyPrefix = '/cjrt/';
const runtimeOrigin = 'https://cjrtnc.leaningtech.com/4.3/';
const redirectPrefix = '/redirect/';
const redirectOrigin = process.env.REDIRECT_ORIGIN ?? 'http://127.0.0.1:8768';
const mounts = [
    ['/segments4/', join(here, '../../brouter/segments4')],
    ['/', here],
];
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.json': 'application/json',
    '.jar': 'application/java-archive',
};

const stats = {requests: 0, bytes: 0, byPath: {}};

function resolvePath(urlPath) {
    for (const [prefix, dir] of mounts) {
        if (urlPath.startsWith(prefix)) {
            const relative = normalize(decodeURIComponent(urlPath.slice(prefix.length)));
            if (relative.startsWith('..')) {
                return null;
            }
            return join(dir, relative);
        }
    }
    return null;
}

function record(path, bytes) {
    stats.requests += 1;
    stats.bytes += bytes;
    const entry = (stats.byPath[path] ??= {requests: 0, bytes: 0});
    entry.requests += 1;
    entry.bytes += bytes;
}

createServer(async (req, res) => {
    if (delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    res.setHeader('Cache-Control', 'no-cache');
    if (crossOriginIsolated) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }

    if (url.pathname === '/__stats') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(stats));
        if (url.searchParams.has('reset')) {
            Object.assign(stats, {requests: 0, bytes: 0, byPath: {}});
        }
        return;
    }

    if (url.pathname.startsWith(redirectPrefix)) {
        res.statusCode = 302;
        res.setHeader('Location', redirectOrigin + url.pathname.slice(redirectPrefix.length - 1));
        res.end();
        console.log(`302 ${req.method} ${url.pathname} ${req.headers.range ?? ''}`);
        return;
    }

    if (url.pathname.startsWith(runtimeProxyPrefix)) {
        const headers = {'accept-encoding': 'identity'};
        if (req.headers.range) {
            headers.range = req.headers.range;
        }
        const upstream = await fetch(runtimeOrigin + url.pathname.slice(runtimeProxyPrefix.length), {headers});
        res.statusCode = upstream.status;
        for (const name of ['content-type', 'content-range', 'accept-ranges', 'last-modified']) {
            const value = upstream.headers.get(name);
            if (value) {
                res.setHeader(name, value);
            }
        }
        res.setHeader('Cache-Control', 'max-age=3600');
        const body = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Length', body.length);
        record(url.pathname, body.length);
        console.log(`${res.statusCode} PROXY ${url.pathname} ${req.headers.range ?? ''} ${body.length}`);
        res.end(body);
        return;
    }

    let file = resolvePath(url.pathname);
    let stat;
    try {
        stat = statSync(file);
        if (stat.isDirectory()) {
            file = join(file, 'index.html');
            stat = statSync(file);
        }
    } catch {
        res.statusCode = 404;
        res.end();
        console.log(`404 ${req.method} ${url.pathname}`);
        return;
    }

    res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Last-Modified', stat.mtime.toUTCString());

    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    let start = 0;
    let end = stat.size - 1;
    if (range) {
        start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1]);
        end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), end) : end;
        if (start > end) {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${stat.size}`);
            res.end();
            return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }
    const length = end - start + 1;
    res.setHeader('Content-Length', length);
    if (req.method === 'HEAD') {
        res.end();
        console.log(`${res.statusCode} HEAD ${url.pathname}`);
        return;
    }
    record(url.pathname, length);
    console.log(`${res.statusCode} ${req.method} ${url.pathname} ${range ? req.headers.range : ''} ${length}`);
    createReadStream(file, {start, end}).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
