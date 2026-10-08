import { config } from '@/config';
import { type EngineBackend, mainThreadBackend, workerBackend } from '@/engine/backends';
import { enginePaths } from '@/engine/cheerpj-router';
import { createEngine } from '@/engine/engine';

// Стенд замеров движка (engine-bench.html): холодный старт, время маршрутов и блокировка главного
// потока. Параметры адреса: backend=worker|main-thread (по умолчанию worker), q=<запрос BRouter>,
// runs=<число маршрутов>. Итог — JSON в <pre> и window.__bench.
// Блокировку меряет MessageChannel-пинг: в фоновой вкладке rAF не тикает (AGENTS.md, CheerpJ).

// Тестовый район AGENTS.md: Тбилиси, от ~41.687, 44.776 к телебашне Мтацминда, тайл E40_N40.
const DEFAULT_QUERY =
    'lonlats=44.776000,41.687000|44.751500,41.694700&profile=hiking-mountain&alternativeidx=0&format=geojson';
// задача длиннее 50 мс — long task по определению Long Tasks API
const LONG_TASK_MS = 50;

interface Blocking {
    maxGapMs: number;
    blockedMs: number;
    pings: number;
}

function startPinger() {
    const channel = new MessageChannel();
    let last = performance.now();
    let stats: Blocking = { maxGapMs: 0, blockedMs: 0, pings: 0 };
    let running = true;
    channel.port1.onmessage = () => {
        const now = performance.now();
        const gap = now - last;
        last = now;
        stats.pings++;
        stats.maxGapMs = Math.max(stats.maxGapMs, gap);
        if (gap > LONG_TASK_MS) {
            stats.blockedMs += gap;
        }
        if (running) {
            channel.port2.postMessage(null);
        }
    };
    channel.port2.postMessage(null);
    return {
        // снимок за фазу и обнуление
        take(): Blocking {
            const result = { ...stats, maxGapMs: Math.round(stats.maxGapMs), blockedMs: Math.round(stats.blockedMs) };
            stats = { maxGapMs: 0, blockedMs: 0, pings: 0 };
            last = performance.now();
            return result;
        },
        stop() {
            running = false;
        },
    };
}

async function run() {
    const params = new URLSearchParams(location.search);
    const backendName = params.get('backend') ?? 'worker';
    const query = params.get('q') ?? DEFAULT_QUERY;
    const runs = Number(params.get('runs') ?? 2);
    const paths = enginePaths(config.routingEngineRuntimeUrl, config.routingTilesPath);
    const backend: () => EngineBackend =
        backendName === 'main-thread' ? () => mainThreadBackend(paths) : () => workerBackend(paths);
    const engine = createEngine([backend]);
    const pinger = startPinger();
    const result: Record<string, unknown> = { backend: backendName, routingTilesPath: config.routingTilesPath };

    let t = performance.now();
    await engine.start();
    result.coldStartMs = Math.round(performance.now() - t);
    result.startBlocking = pinger.take();

    const routes = [];
    for (let i = 0; i < runs; i++) {
        t = performance.now();
        const geojson = await engine.route(query);
        const ms = Math.round(performance.now() - t);
        const feature = JSON.parse(geojson).features[0];
        routes.push({
            ms,
            points: feature.geometry.coordinates.length,
            length: feature.properties['track-length'],
            blocking: pinger.take(),
        });
    }
    result.routes = routes;
    pinger.stop();
    return result;
}

const output = document.getElementById('result') as HTMLElement;
run().then(
    (result) => {
        Object.assign(window, { __bench: result });
        output.textContent = JSON.stringify(result, null, 2);
    },
    (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        Object.assign(window, { __bench: { error: message } });
        output.textContent = `error: ${message}`;
    },
);
