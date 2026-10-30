import type { Breadcrumb, ErrorEvent } from '@sentry/react';

// Очистка отчёта Sentry до отправки (спека clone-monitoring, «Отчёт без места и треков пользователя»; design
// add-error-tracking, «Что уходит и что вырезается»). Место пользователя — в адресе страницы (m=, r=, треки nktk, nktl
// и прочие параметры src/state/sync.ts — во фрагменте #…), в адресах запросов (координаты API высот и BRouter, номера
// тайлов) и в тексте сообщений с такими адресами. Чистые функции без SDK: unit-тесты гоняют их в Node.

// адрес без параметров и фрагмента; не адрес — пустая строка, а не исходный текст
function withoutParams(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
    } catch {
        return '';
    }
}

// любой адрес в тексте — только origin: путь чужого адреса тоже несёт место (z/x/y тайла, E40_N40.rd5 BRouter)
const URL_IN_TEXT = /https?:\/\/[^\s"'<>()]+/g;

function originsOnly(text: string): string {
    return text.replace(URL_IN_TEXT, (url) => {
        try {
            return new URL(url).origin;
        } catch {
            return '';
        }
    });
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
    const { request } = event;
    if (request) {
        if (request.url) {
            request.url = withoutParams(request.url);
        }
        // User-Agent остаётся: по нему Sentry определяет браузер и ОС; Referer — чужая страница, с которой пришли
        const userAgent = request.headers?.['User-Agent'];
        request.headers = userAgent ? { 'User-Agent': userAgent } : undefined;
        delete request.query_string;
        delete request.cookies;
        delete request.data;
    }
    if (event.message) {
        event.message = originsOnly(event.message);
    }
    for (const exception of event.exception?.values ?? []) {
        if (exception.value) {
            exception.value = originsOnly(exception.value);
        }
        // кадры встроенного скрипта и eval несут адрес страницы целиком, вместе с #…; путь скрипта нужен картам
        // исходников, поэтому у кадров — origin и путь
        for (const frame of exception.stacktrace?.frames ?? []) {
            if (frame.filename) {
                frame.filename = withoutParams(frame.filename) || frame.filename;
            }
            if (frame.abs_path) {
                frame.abs_path = withoutParams(frame.abs_path) || frame.abs_path;
            }
        }
    }
    return event;
}

// Остаются только клики и ввод: SDK пишет в них селектор элемента без значения поля. Запросы (fetch, xhr), переходы
// (адрес с #…) и консоль отбрасываются целиком — список разрешённых категорий надёжнее, чем вырезать место по частям.
const KEPT_BREADCRUMBS = new Set(['ui.click', 'ui.input']);

export function keepBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    return breadcrumb.category && KEPT_BREADCRUMBS.has(breadcrumb.category) ? breadcrumb : null;
}
