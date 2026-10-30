import { beforeEach, describe, expect, test, vi } from 'vitest';

// Запуск трекера без сети: SDK подменён, проверяются настройки, которые передаются Sentry.init, и что без DSN SDK не
// трогается вовсе: без Sentry.init у SDK нет клиента и транспорта, отправлять нечем. Отправку и очистку настоящего
// конверта проверяет e2e (e2e/clone-monitoring.spec.ts, заглушка приёма Sentry).
const capture = vi.hoisted(() => vi.fn());
const sentry = vi.hoisted(() => ({
    init: vi.fn(),
    captureException: vi.fn(),
    reactErrorHandler: vi.fn(() => capture),
}));
vi.mock('@sentry/react', () => sentry);

const DSN = 'https://public@o0.ingest.sentry.io/0';
const ORIGIN = 'https://nakarte-routing.pages.dev';

// у модуля своё состояние (запущен ли трекер, о каких бэкендах уже сообщено): каждый тест — с чистого импорта
async function load() {
    vi.resetModules();
    return import('./tracking');
}

async function started() {
    const tracking = await load();
    tracking.startErrorTracking(DSN, ORIGIN);
    return { tracking, options: sentry.init.mock.calls[0][0] };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Запросы к Sentry только с ошибкой', () => {
    test('Сборка без DSN', async () => {
        const tracking = await load();
        expect(tracking.startErrorTracking('', ORIGIN)).toBe(false);
        tracking.reportEngineBackendError('worker', new Error('worker failed'));
        expect(tracking.rootErrorHandler()).toBeUndefined();
        expect(sentry.init).not.toHaveBeenCalled();
        expect(sentry.captureException).not.toHaveBeenCalled();
    });

    test('Заход без ошибок', async () => {
        const { options } = await started();
        // сессия на каждый заход выключена, отчёт клиента об отброшенных событиях — тоже: без ошибки запросов нет
        const defaults = ['BrowserSession', 'GlobalHandlers', 'CultureContext', 'Breadcrumbs'].map((name) => ({
            name,
        }));
        expect(options.integrations(defaults).map((i: { name: string }) => i.name)).toEqual([
            'GlobalHandlers',
            'Breadcrumbs',
        ]);
        expect(options.sendClientReports).toBe(false);
        expect(options.dsn).toBe(DSN);
        expect(options.allowUrls).toEqual([ORIGIN]);
    });
});

describe('Отчёт без места и треков пользователя', () => {
    test('сбор пользователя, кук, заголовков и тел выключен, очистка стоит', async () => {
        const { options } = await started();
        expect(options.dataCollection).toMatchObject({
            userInfo: false,
            cookies: false,
            httpHeaders: { request: { allow: ['user-agent'] }, response: false },
            httpBodies: [],
            urlQueryParams: false,
        });
        // сообщения fetch в приложении (тосты) SDK не трогает
        expect(options.enhanceFetchErrorMessages).toBe('report-only');
        const { keepBreadcrumb, scrubEvent } = await import('./scrub');
        expect(options.beforeSend).toBe(scrubEvent);
        expect(options.beforeBreadcrumb).toBe(keepBreadcrumb);
    });
});

describe('Ошибки в браузере пользователей', () => {
    test('Движок не запустился: отказ бэкенда — один отчёт за загрузку страницы', async () => {
        const { tracking } = await started();
        tracking.reportEngineBackendError('worker', new Error('worker failed'));
        tracking.reportEngineBackendError('worker', new Error('worker failed again'));
        // исключение Java из CheerpJ — не Error
        tracking.reportEngineBackendError('main-thread', { javaClass: 'java.lang.ArithmeticException' });
        expect(sentry.captureException.mock.calls).toEqual([
            [
                new Error('BRouter engine worker failed to start: worker failed'),
                { tags: { 'engine.backend': 'worker' } },
            ],
            [
                new Error('BRouter engine main-thread failed to start: [object Object]'),
                { tags: { 'engine.backend': 'main-thread' } },
            ],
        ]);
    });

    test('ошибка рендера уходит как необработанная и остаётся в консоли', async () => {
        const { tracking } = await started();
        const console = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});
        const handler = tracking.rootErrorHandler();
        const error = new Error('render failed');
        handler?.(error, { componentStack: '\n    at App' });
        // без колбэка: с колбэком SDK пометил бы ошибку handled
        expect(sentry.reactErrorHandler).toHaveBeenCalledWith();
        expect(capture).toHaveBeenCalledWith(error, { componentStack: '\n    at App' });
        expect(console).toHaveBeenCalledWith(error);
        console.mockRestore();
    });
});
