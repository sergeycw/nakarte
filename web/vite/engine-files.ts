import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';

// Файлы движка BRouter для dev-сервера и vite preview. На проде их отдают Pages Functions того же
// origin (functions/brouter-wasm, functions/tiles), локально — этот middleware и прокси /tiles на
// nakarte-tiles-worker (vite.config.ts). CheerpJ читает /app/ только Range-запросами и без 206 с
// Content-Range не видит размер файла (AGENTS.md, «Движок в браузере (CheerpJ)»), поэтому статика Vite
// (вне root и без гарантий Range) не годится. Раскладка — как у functions/brouter-wasm и functions/tiles на проде.

const REPO = fileURLToPath(new URL('../../', import.meta.url));

// [префикс URL, каталог]. lib и profiles кладёт experiments/wasm/cheerpj/build.sh, тайлы для режима без
// clone — scripts/brouter-segments.sh (config.routingTilesPath = /brouter-wasm/segments4/).
export type Mounts = Array<[prefix: string, dir: string]>;

const DEFAULT_MOUNTS: Mounts = [
    ['/brouter-wasm/lib/', path.join(REPO, 'experiments/wasm/cheerpj/lib')],
    ['/brouter-wasm/profiles/', path.join(REPO, 'experiments/wasm/cheerpj/profiles')],
    ['/brouter-wasm/segments4/', path.join(REPO, 'brouter/segments4')],
];

// Что уходит в сборку: код и профили движка. На проде их отдаёт с Range functions/brouter-wasm из статики Pages, а
// тайлы — functions/tiles из R2, поэтому segments4 в сборку не кладётся.
const BUILD_MOUNTS: Mounts = DEFAULT_MOUNTS.filter(([prefix]) => prefix !== '/brouter-wasm/segments4/');

// Копирует каталоги движка в сборку (<outDir>/brouter-wasm/lib, …), как CopyWebpackPlugin старого клиента. Возвращает
// каталоги, которых нет: без experiments/wasm/cheerpj/build.sh сборка проходит без движка (check-web.yml), а деплой
// ловит это своей проверкой файлов в build/.
export function copyEngineFiles(outDir: string, mounts: Mounts = BUILD_MOUNTS): string[] {
    const missing: string[] = [];
    for (const [prefix, dir] of mounts) {
        if (!existsSync(dir)) {
            missing.push(dir);
            continue;
        }
        cpSync(dir, path.join(outDir, prefix), { recursive: true });
    }
    return missing;
}

// BRouter читает storageconfig.txt из каталога тайлов; functions/tiles отдаёт его пустым, как и старый dev-сервер.
const EMPTY_FILES = new Set(['/brouter-wasm/segments4/storageconfig.txt']);

const RANGE = /^bytes=(\d*)-(\d*)$/;

export type ByteRange = { start: number; end: number } | 'unsatisfiable' | null;

// Тот же разбор, что в functions/brouter-wasm: один диапазон, суффикс `bytes=-N`, конец обрезается по размеру.
export function parseRange(header: string | undefined, size: number): ByteRange {
    const match = RANGE.exec(header ?? '');
    if (!match || (match[1] === '' && match[2] === '')) {
        return null;
    }
    const [, from, to] = match;
    const range =
        from === ''
            ? { start: Math.max(size - Number(to), 0), end: size - 1 }
            : { start: Number(from), end: to === '' ? size - 1 : Math.min(Number(to), size - 1) };
    return range.start > range.end ? 'unsatisfiable' : range;
}

export function resolveEngineFile(url: string, mounts: Mounts): string | null {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    for (const [prefix, dir] of mounts) {
        if (!pathname.startsWith(prefix)) {
            continue;
        }
        const file = path.resolve(dir, pathname.slice(prefix.length));
        return file.startsWith(dir + path.sep) ? file : null;
    }
    return null;
}

export const engineFilesMiddleware =
    (mounts: Mounts = DEFAULT_MOUNTS): Connect.NextHandleFunction =>
    (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/brouter-wasm/')) {
            next();
            return;
        }
        res.setHeader('Accept-Ranges', 'bytes');
        if (EMPTY_FILES.has(new URL(url, 'http://localhost').pathname)) {
            res.setHeader('Content-Length', '0');
            res.end();
            return;
        }
        const file = resolveEngineFile(url, mounts);
        const stat = file ? statSync(file, { throwIfNoEntry: false }) : undefined;
        if (!file || !stat?.isFile()) {
            res.statusCode = 404;
            res.end();
            return;
        }
        const range = parseRange(req.headers.range, stat.size);
        if (range === 'unsatisfiable') {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${stat.size}`);
            res.end();
            return;
        }
        if (!range) {
            res.setHeader('Content-Length', String(stat.size));
            req.method === 'HEAD' ? res.end() : createReadStream(file).pipe(res);
            return;
        }
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
        res.setHeader('Content-Length', String(range.end - range.start + 1));
        req.method === 'HEAD' ? res.end() : createReadStream(file, range).pipe(res);
    };

export function engineFiles(): Plugin {
    const middleware = engineFilesMiddleware();
    return {
        name: 'nakarte-engine-files',
        // middleware до внутренних Vite: Range и файлы вне root проекта статика Vite не отдаёт
        configureServer: (server) => {
            server.middlewares.use(middleware);
        },
        configurePreviewServer: (server) => {
            server.middlewares.use(middleware);
        },
        writeBundle(options) {
            const missing = copyEngineFiles(options.dir ?? path.join(REPO, 'build'));
            if (missing.length) {
                this.warn(
                    `engine files are not in the build, run experiments/wasm/cheerpj/build.sh: ${missing.join(', ')}`,
                );
            }
        },
    };
}
