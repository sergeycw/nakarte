import type { TrackSources } from './sources';

// Подставная сеть для unit-тестов треков: ответы по точному адресу, всё остальное — ошибка сети (тест в сеть не ходит)

export const TEST_PROXY = 'https://proxy.test/';
export const TEST_STORAGE = 'https://tracks.test';

export interface FakeResponse {
    status?: number;
    body: string | Uint8Array;
}

export function fakeSources(responses: Record<string, FakeResponse> = {}) {
    const requested: string[] = [];
    const sources: TrackSources = {
        corsProxyUrl: TEST_PROXY,
        tracksStorageServer: TEST_STORAGE,
        fetch: async (input) => {
            const url = String(input);
            requested.push(url);
            const response = responses[url];
            if (!response) {
                throw new TypeError(`Failed to fetch ${url}`);
            }
            const body = typeof response.body === 'string' ? response.body : new Blob([response.body as BlobPart]);
            return new Response(body, { status: response.status ?? 200 });
        },
    };
    return { sources, requested };
}

// Адрес через прокси, как его строит импорт: <прокси>https/host/path
export function viaTestProxy(url: string) {
    return TEST_PROXY + url.replace(/^(https?):\/\//u, '$1/');
}
