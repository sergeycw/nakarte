import * as Sentry from '@sentry/react';
import { keepBreadcrumb, scrubEvent } from './scrub';

// Трекер ошибок в браузере пользователя — Sentry (спека clone-monitoring, «Ошибки в браузере пользователей» и
// «Запросы к Sentry только с ошибкой»; design add-error-tracking). Включается только адресом проекта (DSN) из сборки
// прода: без него Sentry.init не зовётся, и ни обработчиков, ни запросов нет — dev-сервер, тесты, форки.

const DROPPED_INTEGRATIONS = new Set(['BrowserSession', 'CultureContext']);

let started = false;
// бэкенды движка, об отказе которых уже отправлен отчёт: движок перезапускается на каждом запросе маршрута, и один
// сломанный браузер иначе выбрал бы месячный лимит повторами
const reportedBackends = new Set<string>();

// origin — параметр ради unit-тестов в Node, где нет location
export function startErrorTracking(dsn: string, origin = window.location.origin): boolean {
    if (!dsn) {
        return false;
    }
    Sentry.init({
        dsn,
        environment: 'production',
        // BrowserSession шлёт сессию на каждый заход, даже без ошибки; CultureContext — часовой пояс, то есть регион
        integrations: (defaults) => defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
        // отчёт клиента об отброшенных событиях (ошибки расширений вне allowUrls) уходит при скрытии вкладки — запрос без
        // нашей ошибки (ревью диффа)
        sendClientReports: false,
        // 'always' дописывает хост в error.message каждого упавшего fetch, а сообщения приложение показывает в тостах
        enhanceFetchErrorMessages: 'report-only',
        // только свои скрипты: ошибки расширений и чужих скриптов (Google Maps, CheerpJ с CDN) не тратят лимит.
        // Отчёт без адреса в кадрах SDK пропускает (eventFilters, _isAllowedUrl)
        allowUrls: [origin],
        // в v11 неуказанная категория собирается: пользователь (IP), куки, заголовки, тела запросов (MIGRATION.md 11.x,
        // «sendDefaultPii is replaced by dataCollection»). Каждая выключена явно
        dataCollection: {
            userInfo: false,
            cookies: false,
            // User-Agent — браузер и ОС отчёта; прочие заголовки SDK заменяет на [Filtered], scrubEvent их удаляет
            httpHeaders: { request: { allow: ['user-agent'] }, response: false },
            httpBodies: [],
            urlQueryParams: false,
            graphQL: { document: false, variables: false },
            genAI: { inputs: false, outputs: false },
            mcp: { inputs: false, outputs: false },
            databaseQueryData: false,
            queues: false,
        },
        beforeSend: scrubEvent,
        beforeBreadcrumb: keepBreadcrumb,
    });
    started = true;
    return true;
}

// Отказ одного бэкенда движка (воркер или главный поток) — отдельным отчётом, не чаще раза за загрузку страницы.
// Отказ прокладки маршрута сюда не приходит: это ответ роутера, а не ошибка (спека, «Маршрута нет»)
export function reportEngineBackendError(backend: string, error: unknown): void {
    if (!started || reportedBackends.has(backend)) {
        return;
    }
    reportedBackends.add(backend);
    // своя ошибка, а не исходная: исходную создаёт код CheerpJ с CDN, и allowUrls по её последнему кадру отбросил бы
    // отчёт; исключение Java — вовсе не Error (ревью диффа). Текст исходной — в сообщении
    const text = error instanceof Error ? error.message : String(error);
    Sentry.captureException(new Error(`BRouter engine ${backend} failed to start: ${text}`), {
        tags: { 'engine.backend': backend },
    });
}

// Обработчик ошибок рендера для createRoot: со стеком компонентов. Без трекера — undefined, и React ведёт себя как
// раньше (reportError в консоль)
export function rootErrorHandler(): ((error: unknown, errorInfo: { componentStack?: string }) => void) | undefined {
    if (!started) {
        return undefined;
    }
    // без колбэка: с колбэком SDK помечает ошибку handled, а упавший рендер снимает всё приложение. React со своим
    // onUncaughtError консоль больше не пишет — печатаем сами, чтобы ошибка была видна и при трекере
    const capture = Sentry.reactErrorHandler();
    return (error, errorInfo) => {
        capture(error, errorInfo);
        console.error(error);
    };
}
