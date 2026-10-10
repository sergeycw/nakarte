import { matchTrackLink } from '@/tracks/import-url';
import { isCoordinatesQuery, searchCoordinates } from './coordinates';
import { isLinkQuery, type LinkSources, searchLink, UNSUPPORTED_LINK } from './links';
import { MAPYCZ_ATTRIBUTION, mapyczUrl, type PlaceQuery, parseMapycz } from './mapycz';
import { PHOTON_ATTRIBUTION, parsePhoton, photonUrl } from './photon';
import type { SearchItem, TrackLinkResult } from './result';

// Один поиск строки (design add-web-search-panoramas, «Поиск по названию»): ссылка → координаты → mapy.cz через прокси →
// photon напрямую, если mapy.cz не ответил. Отмена — signal (новый запрос отменяет прежний).

export const MIN_QUERY_LENGTH = 3;

export interface Attribution {
    text: string;
    url: string;
}

export type SearchOutcome =
    | { kind: 'results'; results: SearchItem[]; attribution: Attribution | null }
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

const outcome = (results: SearchItem[], attribution: Attribution | null): SearchOutcome =>
    results.length ? { kind: 'results', results, attribution } : { kind: 'error', message: 'Nothing found' };

export const OPEN_AS_TRACK = 'Open as track';

// Ссылка (design search-track-links, «Порядок разбора ссылки»): трек известного источника, за ним вид карты из той же
// ссылки; «любой файл» — только если ссылка не трек и не ссылка на карту. Трек здесь только узнаётся, качает его выбор
async function searchAnyLink(text: string, sources: SearchSources): Promise<SearchOutcome> {
    const track = matchTrackLink(text);
    // у «любого файла» имя из пути мало что говорит (data, 123) — в подписи хост
    const subtitle = track?.file ? `${OPEN_AS_TRACK} · ${new URL(text).host}` : OPEN_AS_TRACK;
    const asTrack: TrackLinkResult[] = track ? [{ kind: 'track', title: track.title, subtitle, url: text }] : [];
    if (track && !track.file) {
        const view = /^https?:/u.test(text) ? await searchLink(text, sources) : null;
        return outcome([...asTrack, ...(view && 'results' in view ? view.results : [])], null);
    }
    const view = await searchLink(text, sources);
    if ('results' in view) {
        return outcome(view.results, null);
    }
    return view.error === UNSUPPORTED_LINK && asTrack.length
        ? outcome(asTrack, null)
        : { kind: 'error', message: view.error };
}

export async function search(query: string, context: SearchContext, sources: SearchSources): Promise<SearchOutcome> {
    const text = query.trim();
    if (isLinkQuery(text)) {
        return searchAnyLink(text, sources);
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
