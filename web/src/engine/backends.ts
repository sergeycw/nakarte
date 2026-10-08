import { type EnginePaths, loadRouter, type RouteFn } from './cheerpj-router';

// Где живёт CheerpJ. engine.ts видит только этот интерфейс, поэтому очередь, отмену и запасной путь
// unit-тесты проверяют с поддельным бэкендом, без рантайма с CDN.
export interface EngineBackend {
    readonly name: 'worker' | 'main-thread';
    start(): Promise<void>;
    route(query: string): Promise<string>;
    dispose(): void;
}

function errorText(event: Event): string {
    return event instanceof ErrorEvent && event.message ? event.message : 'engine worker failed to load';
}

// new URL(...) прямо внутри new Worker(...): только так Vite находит и собирает воркер (vite.dev,
// Features → Web Workers). Без type: 'module' — классический воркер ради importScripts.
function createEngineWorker(): Worker {
    return new Worker(new URL('./engine.worker.ts', import.meta.url), { name: 'brouter' });
}

// createWorker — параметр ради browser-теста протокола с поддельным воркером.
export function workerBackend(paths: EnginePaths, createWorker: () => Worker = createEngineWorker): EngineBackend {
    let worker: Worker | null = null;
    let nextId = 0;
    const pending = new Map<number, { resolve: (geojson: string) => void; reject: (error: Error) => void }>();

    function failPending(error: Error) {
        for (const request of pending.values()) {
            request.reject(error);
        }
        pending.clear();
    }

    return {
        name: 'worker',
        start() {
            return new Promise<void>((resolve, reject) => {
                const created = createWorker();
                worker = created;
                created.addEventListener('error', (event) => {
                    const error = new Error(errorText(event));
                    failPending(error);
                    reject(error);
                });
                created.addEventListener('message', (event: MessageEvent<EngineProtocol.FromWorker>) => {
                    const message = event.data;
                    if (message.type === 'started') {
                        resolve();
                        return;
                    }
                    if (message.type === 'start-failed') {
                        reject(new Error(message.message));
                        return;
                    }
                    const request = pending.get(message.id);
                    pending.delete(message.id);
                    if (message.type === 'routed') {
                        request?.resolve(message.geojson);
                        return;
                    }
                    request?.reject(new Error(message.message));
                });
                created.postMessage({ type: 'start', paths } satisfies EngineProtocol.ToWorker);
            });
        },
        route(query) {
            return new Promise<string>((resolve, reject) => {
                if (!worker) {
                    reject(new Error('engine is not started'));
                    return;
                }
                const id = nextId++;
                pending.set(id, { resolve, reject });
                worker.postMessage({ type: 'route', id, query } satisfies EngineProtocol.ToWorker);
            });
        },
        dispose() {
            worker?.terminate();
            worker = null;
            failPending(new Error('engine worker terminated'));
        },
    };
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`failed to load ${src}`));
        document.head.append(script);
    });
}

// Запасной путь: CheerpJ на главном потоке, как в старом клиенте. Страница подвисает на время маршрута,
// но прокладка работает там, где воркер не поднялся.
export function mainThreadBackend(paths: EnginePaths): EngineBackend {
    let router: RouteFn | null = null;
    return {
        name: 'main-thread',
        async start() {
            router = await loadRouter(loadScript, paths);
        },
        route(query) {
            if (!router) {
                return Promise.reject(new Error('engine is not started'));
            }
            return router(query);
        },
        // рантайм со страницы не выгрузить; повторный запуск берёт уже прошедший cheerpjInit (loadRouter)
        dispose() {},
    };
}
