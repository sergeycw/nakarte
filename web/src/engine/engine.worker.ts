// Воркер движка. Классический, не module: загрузчик CheerpJ объявляет cheerpjInit глобальной функцией
// и подключается только importScripts (документация CheerpJ, «Migration from CheerpJ 2»: CheerpJWorker
// убран, в воркере — importScripts). Vite в dev отдаёт воркер почти как есть: import в классическом
// воркере падает с «Cannot use import statement outside a module», а после `import type` Vite оставляет
// `export {}` («Unexpected token 'export'»). Поэтому импортов нет совсем, типы сообщений — глобальные
// (protocol.d.ts), а обвязка CheerpJ повторяет loadRouter из cheerpj-router.ts: правка одной — правка обеих.
// tsconfig собирает приложение с lib DOM, а не WebWorker, поэтому глобалы воркера объявлены вручную.
declare function importScripts(...urls: string[]): void;
declare function postMessage(message: EngineProtocol.FromWorker): void;
declare function cheerpjInit(options: { version: number; status: string }): Promise<void>;
declare function cheerpjRunLibrary(classpath: string): Promise<{ WasmRouter: Promise<WasmRouterClass> }>;

interface WasmRouterClass {
    route(segmentDir: string, profileDir: string, query: string): Promise<unknown>;
}

type RouteFn = (query: string) => Promise<string>;

async function javaErrorMessage(error: unknown): Promise<string> {
    try {
        const message = await (error as { getMessage(): Promise<unknown> }).getMessage();
        if (message != null) {
            return String(message);
        }
    } catch {
        // не исключение Java
    }
    return error instanceof Error ? error.message : String(error);
}

async function loadRouter(paths: EngineProtocol.Paths): Promise<RouteFn> {
    importScripts(paths.runtimeUrl);
    await cheerpjInit({ version: 11, status: 'none' });
    const lib = await cheerpjRunLibrary(paths.classpath);
    const router = await lib.WasmRouter;
    return async (query) => {
        try {
            return String(await router.route(paths.segmentDir, paths.profileDir, query));
        } catch (error) {
            throw new Error(await javaErrorMessage(error));
        }
    };
}

function text(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

let router: Promise<RouteFn> | null = null;

async function start(paths: EngineProtocol.Paths) {
    router ??= loadRouter(paths);
    try {
        await router;
        postMessage({ type: 'started' });
    } catch (error) {
        router = null;
        postMessage({ type: 'start-failed', message: text(error) });
    }
}

async function route(id: number, query: string) {
    try {
        if (!router) {
            throw new Error('engine is not started');
        }
        const geojson = await (await router)(query);
        postMessage({ type: 'routed', id, geojson });
    } catch (error) {
        postMessage({ type: 'route-failed', id, message: text(error) });
    }
}

addEventListener('message', (event) => {
    const message = (event as MessageEvent<EngineProtocol.ToWorker>).data;
    if (message.type === 'start') {
        void start(message.paths);
        return;
    }
    void route(message.id, message.query);
});
