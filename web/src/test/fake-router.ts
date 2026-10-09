import type { EngineStatus } from '@/engine/engine';
import type { Activity } from '@/routing/brouter';
import type { Router } from '@/routing/router';
import type { LatLng } from '@/tracks/model';

// Поддельный роутер для browser-тестов редактора: каждый запрос ждёт, пока тест ответит сам (resolve/reject), или
// сразу получает прямую с изломом посередине (auto). В сеть не ходит; состояние движка задаёт тест.

export interface FakeCall {
    from: LatLng;
    to: LatLng;
    activity: Activity;
    signal?: AbortSignal;
    resolve(points: LatLng[]): void;
    reject(error: Error): void;
}

export interface FakeRouter extends Router {
    calls: FakeCall[];
    // запросы, которые ещё ждут ответа
    live(): FakeCall[];
    setStatus(status: EngineStatus): void;
    warmUps: number;
}

// «маршрут» между двумя точками: излом посередине, чтобы упрощение его не схлопнуло
export function bend(from: LatLng, to: LatLng): LatLng[] {
    return [{ lat: (from.lat + to.lat) / 2 + Math.abs(to.lng - from.lng) / 4, lng: (from.lng + to.lng) / 2 }];
}

export function fakeRouter({ auto = false, status = 'ready' as EngineStatus } = {}): FakeRouter {
    const listeners = new Set<() => void>();
    const settled = new Set<FakeCall>();
    let current = status;
    const router: FakeRouter = {
        calls: [],
        warmUps: 0,
        live: () => router.calls.filter((call) => !call.signal?.aborted && !settled.has(call)),
        setStatus(next) {
            current = next;
            for (const listener of listeners) {
                listener();
            }
        },
        route: (from, to, activity, signal) =>
            new Promise((resolve, reject) => {
                const call: FakeCall = {
                    from,
                    to,
                    activity,
                    signal,
                    resolve: (points) => {
                        settled.add(call);
                        resolve(points);
                    },
                    reject: (error) => {
                        settled.add(call);
                        reject(error);
                    },
                };
                router.calls.push(call);
                signal?.addEventListener('abort', () => reject(signal.reason));
                if (auto) {
                    call.resolve(bend(from, to));
                }
            }),
        warmUp: () => {
            router.warmUps += 1;
        },
        isReachable: async () => current !== 'failed',
        status: () => current,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    return router;
}
