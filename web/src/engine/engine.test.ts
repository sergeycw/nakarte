import { afterEach, describe, expect, test, vi } from 'vitest';
import type { EngineBackend } from './backends';
import { createEngine, EngineStartError } from './engine';

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
        dispose() {
            counters.disposed++;
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
