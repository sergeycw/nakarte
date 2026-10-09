import { isCoordinatesQuery, searchCoordinates } from './coordinates';
import { isLinkQuery, type LinkSources, searchLink } from './links';
import { MAPYCZ_ATTRIBUTION, mapyczUrl, type PlaceQuery, parseMapycz } from './mapycz';
import { PHOTON_ATTRIBUTION, parsePhoton, photonUrl } from './photon';
import type { SearchResult } from './result';

// Один поиск строки (design add-web-search-panoramas, «Поиск по названию»): ссылка → координаты → mapy.cz через прокси →
// photon напрямую, если mapy.cz не ответил. Отмена — signal (новый запрос отменяет прежний).

export const MIN_QUERY_LENGTH = 3;

export interface Attribution {
    text: string;
    url: string;
}

export type SearchOutcome =
    | { kind: 'results'; results: SearchResult[]; attribution: Attribution | null }
    | { kind: 'error'; message: string };

export interface SearchContext extends Omit<PlaceQuery, 'query'> {
    signal?: AbortSignal;
}

export type SearchSources = LinkSources;

class ServiceError extends Error {}

async function getJson(fetchFn: typeof fetch, url: string, signal: AbortSignal | undefined): Promise<unknown> {
    let response: Response;
    try {
        response = await fetchFn(url, { signal });
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }
        throw new ServiceError('network error');
    }
    if (!response.ok) {
        throw new ServiceError(`HTTP ${response.status}`);
    }
    try {
        return await response.json();
    } catch {
        throw new ServiceError('unexpected response');
    }
}

const outcome = (results: SearchResult[], attribution: Attribution | null): SearchOutcome =>
    results.length ? { kind: 'results', results, attribution } : { kind: 'error', message: 'Nothing found' };

export async function search(query: string, context: SearchContext, sources: SearchSources): Promise<SearchOutcome> {
    const text = query.trim();
    if (isLinkQuery(text)) {
        const response = await searchLink(text, sources);
        return 'error' in response ? { kind: 'error', message: response.error } : outcome(response.results, null);
    }
    if (isCoordinatesQuery(text)) {
        const response = searchCoordinates(text);
        return 'error' in response ? { kind: 'error', message: response.error } : outcome(response.results, null);
    }
    const place = { ...context, query: text };
    try {
        const json = await getJson(sources.fetch, mapyczUrl(sources.corsProxyUrl, place), context.signal);
        return outcome(parseMapycz(json), MAPYCZ_ATTRIBUTION);
    } catch (error) {
        if (context.signal?.aborted) {
            throw error;
        }
    }
    try {
        const json = await getJson(sources.fetch, photonUrl(place), context.signal);
        return outcome(parsePhoton(json), PHOTON_ATTRIBUTION);
    } catch (error) {
        if (context.signal?.aborted) {
            throw error;
        }
        return { kind: 'error', message: `Search failed: ${(error as Error).message}` };
    }
}
