import { viaCorsProxy } from '@/layers/catalog';

// Откуда треки берут сеть: fetch и адреса сервисов. Параметром, а не глобально: unit-тесты подставляют ответы-фикстуры,
// browser-тесты — заглушку через проп App (design add-web-tracks, «Импорт по ссылке»).
export interface TrackSources {
    fetch: typeof fetch;
    corsProxyUrl: string;
    tracksStorageServer: string;
    // API высот (спека elevation-api): GPX с высотами и профиль
    elevationsServer: string;
}

export function proxied(sources: TrackSources, url: string): string {
    return viaCorsProxy(sources.corsProxyUrl, url);
}

// fetch, который не бросает: сетевая ошибка (CORS, обрыв) — null, как отказ xhr-promise старого клиента
export async function fetchOrNull(sources: TrackSources, url: string): Promise<Response | null> {
    try {
        return await sources.fetch(url);
    } catch {
        return null;
    }
}
