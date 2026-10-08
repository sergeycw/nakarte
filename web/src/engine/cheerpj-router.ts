// Пути движка и обвязка CheerpJ для запасного пути на главном потоке. Воркер (engine.worker.ts)
// повторяет loadRouter у себя: классический воркер в dev Vite не может ничего импортировать — правка
// одной копии — правка обеих. Справочник — движок старого клиента src/lib/brouter/browser-engine.js и
// класс WasmRouter из experiments/wasm/cheerpj/java/.

export type EnginePaths = EngineProtocol.Paths;

const BASE_DIR = '/app/brouter-wasm/';
const JARS = ['lib/brouter-patch.jar', 'lib/brouter.jar', 'lib/wasm-router.jar'];

export function enginePaths(runtimeUrl: string, routingTilesPath: string): EnginePaths {
    return {
        runtimeUrl,
        // brouter-patch.jar первым: его классы подменяют одноимённые из brouter.jar
        classpath: JARS.map((jar) => BASE_DIR + jar).join(':'),
        segmentDir: `/app${routingTilesPath}`,
        profileDir: `${BASE_DIR}profiles/`,
    };
}

export type RouteFn = (query: string) => Promise<string>;

interface WasmRouterClass {
    route(segmentDir: string, profileDir: string, query: string): Promise<unknown>;
}

interface CheerpjGlobals {
    cheerpjInit(options: { version: number; status: string }): Promise<void>;
    cheerpjRunLibrary(classpath: string): Promise<{ WasmRouter: Promise<WasmRouterClass> }>;
}

// Исключение Java приходит JS-объектом с асинхронным getMessage(). Переполнение стека в CheerpJ —
// ArithmeticException без текста (AGENTS.md), тогда остаётся только имя.
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

// cheerpjInit — один раз на глобальную область: второй вызов бросает «CheerpJ: Already initialized»
// (проверено в design spike-engine-in-worker). Поэтому повторный запуск после сбоя на главном потоке
// берёт уже прошедшую инициализацию, а не зовёт её снова.
let initialized: Promise<void> | null = null;

export async function loadRouter(loadScript: (url: string) => Promise<void>, paths: EnginePaths): Promise<RouteFn> {
    initialized ??= loadScript(paths.runtimeUrl)
        .then(() => (globalThis as unknown as CheerpjGlobals).cheerpjInit({ version: 11, status: 'none' }))
        .catch((error: unknown) => {
            initialized = null;
            throw error;
        });
    await initialized;
    const lib = await (globalThis as unknown as CheerpjGlobals).cheerpjRunLibrary(paths.classpath);
    const router = await lib.WasmRouter;
    return async (query) => {
        try {
            return String(await router.route(paths.segmentDir, paths.profileDir, query));
        } catch (error) {
            throw new Error(await javaErrorMessage(error));
        }
    };
}
