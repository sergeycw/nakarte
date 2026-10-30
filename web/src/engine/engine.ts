import { config } from '@/config';
import { reportEngineBackendError } from '@/errors/tracking';
import { type EngineBackend, mainThreadBackend, workerBackend } from './backends';
import { enginePaths } from './cheerpj-router';

// Движок BRouter в браузере (спека browser-routing-engine). Синглтон вне React: CheerpJ даёт один
// library-поток на страницу, а Strict Mode в dev вызывает эффекты дважды, поэтому движок не создаётся
// в компоненте. Компоненты получают только промисы: startEngine() — прогрев при выборе активности,
// routeInEngine() — маршрут в очереди. Пока их никто не вызвал, рантайм не грузится.

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

// Движок не запустился ни в воркере, ни на главном потоке (или завис на главном потоке): для UI это «роутер недоступен».
export class EngineStartError extends Error {
    override name = 'EngineStartError';
}

// Расчёт не закончился за routeTimeout: для UI — ошибка отрезка, роутер жив (движок в воркере перезапустится)
export class EngineTimeoutError extends Error {
    override name = 'EngineTimeoutError';
}

// Таймаут расчёта (design add-engine-timeout): вдвое больше серверных 30 с — движок читает тайлы по сети и на
// телефоне медленнее сервера. Отсчёт — с начала расчёта, очередь и холодный старт не входят
export const ENGINE_ROUTE_TIMEOUT = 60_000;

export interface EngineOptions {
    routeTimeout?: number;
    // отказ запуска одного бэкенда, до перехода к следующему: трекер ошибок (спека clone-monitoring, «Движок не
    // запустился»). Итоговый EngineStartError и отказ маршрута сюда не приходят
    onBackendError?: (backend: EngineBackend['name'], error: unknown) => void;
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
export function createEngine(
    backends: Array<() => EngineBackend>,
    { routeTimeout = ENGINE_ROUTE_TIMEOUT, onBackendError }: EngineOptions = {},
): Engine {
    let current: EngineBackend | null = null;
    // движок на главном потоке завис: его не выгрузить и не запустить заново (повторный cheerpjInit бросает), так что
    // до перезагрузки страницы роутер недоступен
    let hung = false;
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
                onBackendError?.(backend.name, error);
            }
        }
        setStatus('failed');
        const reason = lastError instanceof Error ? lastError.message : String(lastError);
        throw new EngineStartError(`BRouter engine failed to start: ${reason}`);
    }

    function ensureStarted(): Promise<EngineBackend> {
        if (hung) {
            return Promise.reject(new EngineStartError('BRouter engine stopped responding'));
        }
        if (!starting) {
            starting = startBackends().catch((error: unknown) => {
                // сбой запуска не залипает: следующий запрос маршрута пробует снова
                starting = null;
                throw error;
            });
        }
        return starting;
    }

    // Зависший расчёт не прервать изнутри CheerpJ. Воркер завершается, и следующий запрос проходит ensureStarted с
    // начала — новый воркер, чистый перезапуск; движок сразу прогревается, чтобы следующий клик не ждал холодный старт.
    // Главный поток не выгрузить: движок помечается зависшим, пока расчёт не закончится (сработавший таймер значит,
    // что CheerpJ отпускал поток, — скорее медленный маршрут, чем мёртвый)
    function afterTimeout(backend: EngineBackend, route: Promise<string>) {
        if (backend.name === 'main-thread') {
            hung = true;
            setStatus('failed');
            route
                .catch(() => {})
                .finally(() => {
                    hung = false;
                    setStatus('ready');
                });
            return;
        }
        // dispose отклоняет зависший route — уже после таймаута, гонку выиграла ошибка таймаута (ревью диффа)
        backend.dispose();
        current = null;
        starting = null;
        setStatus('idle');
        ensureStarted().catch(() => {});
    }

    async function routeWithTimeout(backend: EngineBackend, query: string): Promise<string> {
        const route = backend.route(query);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                reject(
                    backend.name === 'main-thread'
                        ? new EngineStartError('BRouter engine stopped responding')
                        : new EngineTimeoutError(
                              `BRouter engine did not answer in ${Math.round(routeTimeout / 1000)} s`,
                          ),
                );
                afterTimeout(backend, route);
            }, routeTimeout);
        });
        try {
            return await Promise.race([route, timeout]);
        } finally {
            clearTimeout(timer);
        }
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
                // получает отказ сразу, а следующий запрос ждёт, пока движок освободится или выйдет таймаут.
                const onAbort = () => reject(signal?.reason);
                signal?.addEventListener('abort', onAbort, { once: true });
                const run = async () => {
                    if (signal?.aborted) {
                        return;
                    }
                    try {
                        const backend = await ensureStarted();
                        resolve(await routeWithTimeout(backend, query));
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
    // отчёт трекера — только у движка приложения: стенд /engine-bench.html и тесты собирают свой без него
    engine ??= createEngine(defaultBackends(), { onBackendError: reportEngineBackendError });
    return engine;
}

export const startEngine = () => getEngine().start();
export const routeInEngine = (query: string, signal?: AbortSignal) => getEngine().route(query, signal);
