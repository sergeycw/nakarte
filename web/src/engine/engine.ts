import { config } from '@/config';
import { type EngineBackend, mainThreadBackend, workerBackend } from './backends';
import { enginePaths } from './cheerpj-router';

// Движок BRouter в браузере (спека browser-routing-engine). Синглтон вне React: CheerpJ даёт один
// library-поток на страницу, а Strict Mode в dev вызывает эффекты дважды, поэтому движок не создаётся
// в компоненте. Компоненты получают только промисы: startEngine() — прогрев при выборе активности,
// routeInEngine() — маршрут в очереди. Пока их никто не вызвал, рантайм не грузится.

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

// Движок не запустился ни в воркере, ни на главном потоке: для UI это «роутер недоступен».
export class EngineStartError extends Error {
    override name = 'EngineStartError';
}

export interface Engine {
    start(): Promise<void>;
    route(query: string, signal?: AbortSignal): Promise<string>;
    status(): EngineStatus;
    // где сейчас работает движок; null, пока он не запущен
    backend(): EngineBackend['name'] | null;
    subscribe(listener: () => void): () => void;
}

// Бэкенды пробуются по порядку: первый поднявшийся становится движком. Неудачный выбрасывается
// (воркер завершается), следующий запуск снова начинает с первого.
export function createEngine(backends: Array<() => EngineBackend>): Engine {
    let current: EngineBackend | null = null;
    let starting: Promise<EngineBackend> | null = null;
    let status: EngineStatus = 'idle';
    // хвост очереди: запросы идут в движок строго по одному, хвост никогда не отклоняется
    let tail: Promise<void> = Promise.resolve();
    const listeners = new Set<() => void>();

    function setStatus(next: EngineStatus) {
        status = next;
        for (const listener of listeners) {
            listener();
        }
    }

    async function startBackends(): Promise<EngineBackend> {
        setStatus('loading');
        let lastError: unknown = null;
        for (const create of backends) {
            const backend = create();
            try {
                await backend.start();
                current = backend;
                setStatus('ready');
                return backend;
            } catch (error) {
                backend.dispose();
                lastError = error;
            }
        }
        setStatus('failed');
        const reason = lastError instanceof Error ? lastError.message : String(lastError);
        throw new EngineStartError(`BRouter engine failed to start: ${reason}`);
    }

    function ensureStarted(): Promise<EngineBackend> {
        if (!starting) {
            starting = startBackends().catch((error: unknown) => {
                // сбой запуска не залипает: следующий запрос маршрута пробует снова
                starting = null;
                throw error;
            });
        }
        return starting;
    }

    return {
        async start() {
            await ensureStarted();
        },
        route(query, signal) {
            return new Promise<string>((resolve, reject) => {
                if (signal?.aborted) {
                    reject(signal.reason);
                    return;
                }
                // Отмена снимает запрос из очереди. Начатый расчёт CheerpJ не прервать: вызывающий
                // получает отказ сразу, а следующий запрос ждёт, пока движок действительно освободится.
                const onAbort = () => reject(signal?.reason);
                signal?.addEventListener('abort', onAbort, { once: true });
                const run = async () => {
                    if (signal?.aborted) {
                        return;
                    }
                    try {
                        const backend = await ensureStarted();
                        resolve(await backend.route(query));
                    } catch (error) {
                        reject(error);
                    } finally {
                        signal?.removeEventListener('abort', onAbort);
                    }
                };
                tail = tail.then(run);
            });
        },
        status: () => status,
        backend: () => current?.name ?? null,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

// Рантайм CheerpJ — только с CDN Leaning Technologies (лицензия Community, спека browser-routing-engine).
function defaultBackends(): Array<() => EngineBackend> {
    const paths = enginePaths(config.routingEngineRuntimeUrl, config.routingTilesPath);
    return [() => workerBackend(paths), () => mainThreadBackend(paths)];
}

let engine: Engine | null = null;

export function getEngine(): Engine {
    engine ??= createEngine(defaultBackends());
    return engine;
}

export const startEngine = () => getEngine().start();
export const routeInEngine = (query: string, signal?: AbortSignal) => getEngine().route(query, signal);
