import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Запуск трекера без сети: SDK подменён, проверяются настройки, которые передаются Sentry.init, и что без DSN SDK не
// трогается вовсе. Отправку и очистку настоящего конверта проверяет e2e (web-client.spec.ts, заглушка приёма Sentry).
const sentry = vi.hoisted(() => ({
    init: vi.fn(),
    captureException: vi.fn(),
    reactErrorHandler: vi.fn(() => () => {}),
}));
vi.mock('@sentry/react', () => sentry);

const DSN = 'https://public@o0.ingest.sentry.io/0';
const ORIGIN = 'https://nakarte-routing.pages.dev';

// у модуля своё состояние (запущен ли трекер, о каких бэкендах уже сообщено): каждый тест — с чистого импорта
async function load() {
    vi.resetModules();
    return import('./tracking');
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Запросы к Sentry только с ошибкой', () => {
    test('Сборка без DSN', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch');
        const tracking = await load();
        expect(tracking.startErrorTracking('', ORIGIN)).toBe(false);
        tracking.reportEngineBackendError('worker', new Error('worker failed'));
        expect(tracking.rootErrorHandler()).toBeUndefined();
        expect(sentry.init).not.toHaveBeenCalled();
        expect(sentry.captureException).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    test('Заход без ошибок', async () => {
        const tracking = await load();
        expect(tracking.startErrorTracking(DSN, ORIGIN)).toBe(true);
        const options = sentry.init.mock.calls[0][0];
        // сессия на каждый заход выключена: без ошибки запросов нет
        const defaults = [{ name: 'BrowserSession' }, { name: 'GlobalHandlers' }, { name: 'Breadcrumbs' }];
        expect(options.integrations(defaults).map((i: { name: string }) => i.name)).toEqual([
            'GlobalHandlers',
            'Breadcrumbs',
        ]);
        expect(options.dsn).toBe(DSN);
        expect(options.allowUrls).toEqual([ORIGIN]);
    });
});

describe('Отчёт без места и треков пользователя', () => {
    test('сбор пользователя, кук, заголовков и тел выключен, очистка стоит', async () => {
        const tracking = await load();
        tracking.startErrorTracking(DSN, ORIGIN);
        const options = sentry.init.mock.calls[0][0];
        expect(options.dataCollection).toMatchObject({
            userInfo: false,
            cookies: false,
            httpHeaders: { request: false, response: false },
            httpBodies: [],
            urlQueryParams: false,
        });
        const { keepBreadcrumb, scrubEvent } = await import('./scrub');
        expect(options.beforeSend).toBe(scrubEvent);
        expect(options.beforeBreadcrumb).toBe(keepBreadcrumb);
    });
});

describe('Ошибки в браузере пользователей', () => {
    test('Движок не запустился: отказ бэкенда — один отчёт за загрузку страницы', async () => {
        const tracking = await load();
        tracking.startErrorTracking(DSN, ORIGIN);
        const failed = new Error('worker failed');
        tracking.reportEngineBackendError('worker', failed);
        tracking.reportEngineBackendError('worker', new Error('worker failed again'));
        tracking.reportEngineBackendError('main-thread', new Error('main-thread failed'));
        expect(sentry.captureException.mock.calls).toEqual([
            [failed, { tags: { 'engine.backend': 'worker' } }],
            [new Error('main-thread failed'), { tags: { 'engine.backend': 'main-thread' } }],
        ]);
    });
});
