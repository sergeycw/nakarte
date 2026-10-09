import type { RoutingEngine } from '@/config';
import { type Engine, EngineStartError, type EngineStatus } from '@/engine/engine';
import type { LatLng } from '@/tracks/model';
import { type Activity, parseRoute, RoutingError, routeQuery } from './brouter';

// Роутер нового приложения: движок в браузере (клон) или серверный BRouter (локально, docker-compose.yml) за одним
// интерфейсом — для редактора результат одинаковый: точки отрезка или RoutingError (спека browser-routing-engine,
// «Выбор движка флагом конфигурации»). Отмена — AbortSignal: отклонение с signal.reason, редактор его молча отбрасывает.

export interface Router {
    route(from: LatLng, to: LatLng, activity: Activity, signal?: AbortSignal): Promise<LatLng[]>;
    // прогрев при выборе активности: рантайм движка грузится до первого клика (спека browser-routing-engine)
    warmUp(): void;
    // жив ли роутер: перепроверка при открытии меню прокладки (спека routing, «Недоступный роутер»)
    isReachable(): Promise<boolean>;
    // состояние движка для кнопки прокладки; у сервера загружать нечего — всегда ready
    status(): EngineStatus;
    subscribe(listener: () => void): () => void;
}

export interface RouterOptions {
    engine: RoutingEngine;
    routingServer: string;
    fetch: typeof fetch;
    // движок создаётся лениво (getEngine): пока прокладка выключена, рантайм CheerpJ не грузится
    getEngine: () => Engine;
}

// таймауты старого клиента (lib/brouter): маршрут — 30 с, проверка живости — 3 с
const ROUTE_TIMEOUT = 30_000;
const PROBE_TIMEOUT = 3_000;

function isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
    return signal?.aborted === true && error === signal.reason;
}

export function createRouter({ engine, routingServer, fetch, getEngine }: RouterOptions): Router {
    if (engine === 'browser') {
        return {
            async route(from, to, activity, signal) {
                let geojson: string;
                try {
                    geojson = await getEngine().route(routeQuery(from, to, activity), signal);
                } catch (error) {
                    if (isAbort(error, signal)) {
                        throw error;
                    }
                    if (error instanceof EngineStartError) {
                        throw new RoutingError(error.message, true);
                    }
                    throw new RoutingError(error instanceof Error ? error.message : String(error));
                }
                return parseRoute(geojson, from, to);
            },
            warmUp() {
                getEngine()
                    .start()
                    .catch(() => {});
            },
            // не запущенный ещё движок считается живым: он запустится на первом маршруте (isEngineFailed старого клиента)
            isReachable: async () => getEngine().status() !== 'failed',
            status: () => getEngine().status(),
            subscribe: (listener) => getEngine().subscribe(listener),
        };
    }

    const brouterUrl = new URL('/brouter', routingServer).href;
    return {
        async route(from, to, activity, signal) {
            const timeout = AbortSignal.timeout(ROUTE_TIMEOUT);
            let response: Response;
            try {
                response = await fetch(`${brouterUrl}?${routeQuery(from, to, activity)}`, {
                    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
                });
            } catch (error) {
                if (isAbort(error, signal)) {
                    throw error;
                }
                throw new RoutingError('BRouter is not reachable', true);
            }
            const text = await response.text();
            if (!response.ok) {
                // BRouter пишет причину текстом ответа (datafile … not found, no track found …)
                throw new RoutingError(text.trim() || `HTTP ${response.status}`);
            }
            return parseRoute(text, from, to);
        },
        warmUp() {},
        // GET /brouter без параметров отвечает 404: любой HTTP-ответ — сервер жив, сетевая ошибка — нет
        async isReachable() {
            try {
                await fetch(brouterUrl, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
                return true;
            } catch {
                return false;
            }
        },
        status: () => 'ready',
        subscribe: () => () => {},
    };
}

// Короткий статус для подсказки кнопки и что делать пользователю (routerDownStatus/routerDownHint старого клиента).
// yarn local имеет смысл только для серверного режима.
export function routerDownStatus(engine: RoutingEngine): string {
    return engine === 'browser' ? 'BRouter engine failed to load' : 'BRouter is not running';
}

export function routerDownHint(engine: RoutingEngine): string {
    return engine === 'browser'
        ? 'BRouter engine failed to load, reload the page to retry'
        : 'BRouter is not running, start it with yarn local';
}
