import { afterEach, describe, expect, test, vi } from 'vitest';
import type { EngineBackend } from './backends';
import { createEngine, EngineStartError, EngineTimeoutError } from './engine';

// Сценарии спеки browser-routing-engine на поддельном движке: настоящий рантайм CheerpJ живёт на CDN,
// а тесты в сеть не ходят. Настоящий движок проверяется стендом engine-bench.html.

interface FakeCall {
    query: string;
    resolve: (geojson: string) => void;
    reject: (error: Error) => void;
}

// Бэкенд, которому тест сам отвечает: расчёт «идёт», пока тест не вызовет resolve или reject.
function fakeBackend(name: EngineBackend['name'], options: { failStart?: boolean } = {}) {
    const calls: FakeCall[] = [];
    const counters = { starts: 0, disposed: 0 };
    const backend: EngineBackend = {
        name,
        async start() {
            counters.starts++;
            if (options.failStart) {
                throw new Error(`${name} failed`);
            }
        },
        route(query) {
            return new Promise((resolve, reject) => calls.push({ query, resolve, reject }));
        },
        // как workerBackend: завершение отклоняет начатые расчёты сразу, синхронно
        dispose() {
            counters.disposed++;
            for (const call of calls) {
                call.reject(new Error('engine worker terminated'));
            }
        },
    };
    return { backend, calls, counters };
}

// дать отработать микрозадачам очереди
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Очередь запросов', () => {
    test('Быстрые клики', async () => {
        const fake = fakeBackend('worker');
        const engine = createEngine([() => fake.backend]);
        const results = Promise.allSettled(['a', 'b', 'c'].map((q) => engine.route(q)));
        await flush();
        // в движке всегда один запрос
        expect(fake.calls.map((c) => c.query)).toEqual(['a']);
        fake.calls[0].resolve('A');
        await flush();
        expect(fake.calls.map((c) => c.query)).toEqual(['a', 'b']);
        fake.calls[1].reject(new Error('no route found'));
        await flush();
        fake.calls[2].resolve('C');
        // ошибка одного запроса не мешает следующим, каждый ответ — своему запросу
        expect(await results).toEqual([
            { status: 'fulfilled', value: 'A' },
            { status: 'rejected', reason: new Error('no route found') },
            { status: 'fulfilled', value: 'C' },
        ]);
    });

    test('Отмена запроса в очереди', async () => {
        const fake = fakeBackend('worker');
        const engine = createEngine([() => fake.backend]);
        const controller = new AbortController();
        const first = engine.route('a');
        const cancelled = engine.route('b', controller.signal);
        const third = engine.route('c');
        await flush();
        controller.abort();
        await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
        fake.calls[0].resolve('A');
        await flush();
        // отменённый запрос в движок не попал
        expect(fake.calls.map((c) => c.query)).toEqual(['a', 'c']);
        fake.calls[1].resolve('C');
        await expect(first).resolves.toBe('A');
        await expect(third).resolves.toBe('C');
    });

    test('Отмена во время расчёта', async () => {
        const fake = fakeBackend('worker');
        const engine = createEngine([() => fake.backend]);
        const controller = new AbortController();
        const running = engine.route('a', controller.signal);
        const next = engine.route('b');
        await flush();
        controller.abort();
        // отказ — сразу, не дожидаясь движка
        await expect(running).rejects.toMatchObject({ name: 'AbortError' });
        await flush();
        // следующий ждёт, пока движок закончит текущий расчёт
        expect(fake.calls.map((c) => c.query)).toEqual(['a']);
        fake.calls[0].resolve('A');
        await flush();
        expect(fake.calls.map((c) => c.query)).toEqual(['a', 'b']);
        fake.calls[1].resolve('B');
        await expect(next).resolves.toBe('B');
    });

    test('Уже отменённый запрос', async () => {
        const fake = fakeBackend('worker');
        const engine = createEngine([() => fake.backend]);
        await expect(engine.route('a', AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
        expect(fake.counters.starts).toBe(0);
    });
});

describe('Один движок на страницу', () => {
    test('Повторный выбор активности', async () => {
        const fake = fakeBackend('worker');
        const create = vi.fn(() => fake.backend);
        const engine = createEngine([create]);
        await Promise.all([engine.start(), engine.start(), engine.start()]);
        await engine.start();
        expect(create).toHaveBeenCalledTimes(1);
        expect(fake.counters.starts).toBe(1);
        expect(engine.status()).toBe('ready');
    });

    test('Сбой запуска', async () => {
        let fail = true;
        const fakes: Array<ReturnType<typeof fakeBackend>> = [];
        const engine = createEngine([
            () => {
                fakes.push(fakeBackend('worker', { failStart: fail }));
                return fakes[fakes.length - 1].backend;
            },
        ]);
        await expect(engine.route('a')).rejects.toBeInstanceOf(EngineStartError);
        expect(engine.status()).toBe('failed');
        // следующий запрос маршрута повторяет запуск
        fail = false;
        const next = engine.route('b');
        await flush();
        expect(engine.status()).toBe('ready');
        fakes[1].calls[0].resolve('B');
        await expect(next).resolves.toBe('B');
    });

    test('Статус для кнопки активности', async () => {
        const engine = createEngine([() => fakeBackend('worker').backend]);
        const seen: string[] = [];
        const unsubscribe = engine.subscribe(() => seen.push(engine.status()));
        expect(engine.status()).toBe('idle');
        await engine.start();
        unsubscribe();
        expect(seen).toEqual(['loading', 'ready']);
    });
});

describe('Расчёт маршрута вне главного потока', () => {
    test('Движок вне главного потока не запустился', async () => {
        const worker = fakeBackend('worker', { failStart: true });
        const main = fakeBackend('main-thread');
        const engine = createEngine([() => worker.backend, () => main.backend]);
        const result = engine.route('a');
        await flush();
        // воркер выброшен, маршрут считается на главном потоке в той же попытке
        expect(worker.counters.disposed).toBe(1);
        expect(engine.backend()).toBe('main-thread');
        main.calls[0].resolve('A');
        await expect(result).resolves.toBe('A');
    });

    test('Не запустился нигде', async () => {
        const engine = createEngine([
            () => fakeBackend('worker', { failStart: true }).backend,
            () => fakeBackend('main-thread', { failStart: true }).backend,
        ]);
        await expect(engine.start()).rejects.toThrow('BRouter engine failed to start: main-thread failed');
        expect(engine.backend()).toBeNull();
    });
});

describe('Таймаут расчёта', () => {
    // короткий таймаут вместо 60 с: поддельный бэкенд «считает», пока тест не ответит
    const TIMEOUT = 30;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    test('Движок не ответил вовремя', async () => {
        const fakes: Array<ReturnType<typeof fakeBackend>> = [];
        const engine = createEngine(
            [
                () => {
                    fakes.push(fakeBackend('worker'));
                    return fakes[fakes.length - 1].backend;
                },
            ],
            { routeTimeout: TIMEOUT },
        );
        const seen: string[] = [];
        const result = engine.route('a');
        await flush();
        engine.subscribe(() => seen.push(engine.status()));
        // dispose настоящего воркера отклоняет зависший расчёт синхронно — отказ всё равно об истечении времени
        await expect(result).rejects.toThrow(EngineTimeoutError);
        await expect(result).rejects.toThrow(/^BRouter engine did not answer in \d+ s$/);
        expect(fakes[0].counters.disposed).toBe(1);
        // движок сброшен и сразу прогревается заново: следующий клик не ждёт холодный старт
        await flush();
        expect(seen).toEqual(['idle', 'loading', 'ready']);
        expect(fakes).toHaveLength(2);
        const next = engine.route('b');
        await flush();
        fakes[1].calls[0].resolve('B');
        await expect(next).resolves.toBe('B');
    });

    test('отмена во время зависшего расчёта: отказ сразу, следующий — после таймаута новым движком', async () => {
        const fakes: Array<ReturnType<typeof fakeBackend>> = [];
        const engine = createEngine(
            [
                () => {
                    fakes.push(fakeBackend('worker'));
                    return fakes[fakes.length - 1].backend;
                },
            ],
            { routeTimeout: TIMEOUT },
        );
        const controller = new AbortController();
        const cancelled = engine.route('a', controller.signal);
        const next = engine.route('b');
        await flush();
        controller.abort();
        await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
        await expect.poll(() => fakes[1]?.calls.length ?? 0).toBe(1);
        expect(fakes[0].calls.map((c) => c.query)).toEqual(['a']);
        fakes[1].calls[0].resolve('B');
        await expect(next).resolves.toBe('B');
    });

    test('Очередь за зависшим расчётом', async () => {
        const fakes: Array<ReturnType<typeof fakeBackend>> = [];
        const engine = createEngine(
            [
                () => {
                    fakes.push(fakeBackend('worker'));
                    return fakes[fakes.length - 1].backend;
                },
            ],
            { routeTimeout: TIMEOUT },
        );
        const hung = engine.route('a');
        const queued = [engine.route('b'), engine.route('c')];
        await expect(hung).rejects.toBeInstanceOf(EngineTimeoutError);
        await flush();
        // b считает уже новый движок; ожидание в очереди за зависшим в таймаут не входит
        expect(fakes[1].calls.map((c) => c.query)).toEqual(['b']);
        await wait(TIMEOUT / 2);
        fakes[1].calls[0].resolve('B');
        await flush();
        expect(fakes[1].calls.map((c) => c.query)).toEqual(['b', 'c']);
        await wait(TIMEOUT / 2);
        fakes[1].calls[1].resolve('C');
        expect(await Promise.all(queued)).toEqual(['B', 'C']);
        expect(fakes).toHaveLength(2);
    });

    test('Завис движок на главном потоке', async () => {
        const worker = fakeBackend('worker', { failStart: true });
        const mains: Array<ReturnType<typeof fakeBackend>> = [];
        const engine = createEngine(
            [
                () => worker.backend,
                () => {
                    mains.push(fakeBackend('main-thread'));
                    return mains[mains.length - 1].backend;
                },
            ],
            { routeTimeout: TIMEOUT },
        );
        const hung = engine.route('a');
        const queued = engine.route('b');
        await expect(hung).rejects.toBeInstanceOf(EngineStartError);
        await expect(hung).rejects.toThrow('BRouter engine stopped responding');
        expect(engine.status()).toBe('failed');
        // запрос в очереди и новые — отказ сразу, в движок не уходят, движок заново не запускается
        await expect(queued).rejects.toBeInstanceOf(EngineStartError);
        await expect(engine.route('c')).rejects.toBeInstanceOf(EngineStartError);
        await expect(engine.start()).rejects.toBeInstanceOf(EngineStartError);
        expect(mains).toHaveLength(1);
        expect(mains[0].calls.map((c) => c.query)).toEqual(['a']);
        // расчёт всё-таки закончился: движок снова готов, без перезапуска; поздний ответ первому запросу не уходит
        mains[0].calls[0].resolve('late');
        await flush();
        expect(engine.status()).toBe('ready');
        const after = engine.route('d');
        await flush();
        mains[0].calls[1].resolve('D');
        await expect(after).resolves.toBe('D');
        expect(mains).toHaveLength(1);
    });

    test('ответ в срок — без таймаута и перезапуска', async () => {
        const fake = fakeBackend('worker');
        const engine = createEngine([() => fake.backend], { routeTimeout: TIMEOUT });
        const result = engine.route('a');
        await flush();
        fake.calls[0].resolve('A');
        await expect(result).resolves.toBe('A');
        await wait(TIMEOUT * 2);
        expect(fake.counters.disposed).toBe(0);
        expect(engine.status()).toBe('ready');
    });
});

describe('Синглтон', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    test('Прокладка выключена: импорт и getEngine() ничего не запускают', async () => {
        const created = vi.fn();
        vi.stubGlobal(
            'Worker',
            class {
                constructor() {
                    created();
                }
            },
        );
        const module = await import('./engine');
        const engine = module.getEngine();
        expect(module.getEngine()).toBe(engine);
        expect(engine.status()).toBe('idle');
        expect(created).not.toHaveBeenCalled();
    });
});
