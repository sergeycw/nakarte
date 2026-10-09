import { getActivity } from '@/routing/brouter';
import type { LegMark, SegmentRoute } from '@/routing/line';
import type { GeoData, LatLng } from '@/tracks/model';
import { ARC_UNIT, parseNktkSequence } from '@/tracks/nktk';

// Последняя сессия старого клиента (design switch-to-web-app, «Сессия старого клиента: последняя, один раз»). Старый
// клиент хранил треки вкладки в IndexedDB sessions (src/lib/session-state и leaflet.control.sessions на коммите 015be893):
// хранилище sessionData, keyPath sessionId, индекс mtime, запись {sessionId, mtime, data: {hash, tracks, trackNames,
// routeMarkup}}. tracks — строки nktk через `/` (serializeTracks), routeMarkup — {legs: [[ключ начала, ключ конца,
// activityId], …]} с ключами по сетке nktk (routeMarkupKey). База только читается: не меняется и не создаётся.

export const LEGACY_SESSIONS_DB = 'sessions';
const STORE = 'sessionData';
const MTIME_INDEX = 'mtime';

// routeMarkupKey старого клиента: та же сетка ~2.4 м, что у координат nktk, поэтому ключи точек из разобранной строки
// совпадают с ключами разметки точно
function markupKey(point: LatLng): string {
    return `${Math.round(point.lat * ARC_UNIT)},${Math.round(point.lng * ARC_UNIT)}`;
}

type LegacyLeg = [start: string, end: string, activityId: string];

function legacyLegs(markup: unknown): LegacyLeg[] {
    const legs = (markup as { legs?: unknown } | null | undefined)?.legs;
    if (!Array.isArray(legs)) {
        return [];
    }
    return legs.filter(
        (leg): leg is LegacyLeg =>
            Array.isArray(leg) && leg.length === 3 && leg.every((part) => typeof part === 'string'),
    );
}

// Разметка старой сессии → разметка отрезка (applyRouteMarkupToLine старого): от каждой опорной точки ищется ближайшая
// дальше хотя бы через одну точку, с которой её связывает нога разметки, — точки между ними маршрутные. Нога неизвестной
// активности не считается: прямой отрезок с промежуточными точками разметка нового приложения не допускает, и такие
// точки остаются опорными. Без единой ноги — null, отрезок открывается ломаной.
export function legacyRoute(points: readonly LatLng[], markup: unknown): SegmentRoute | null {
    const activities = new Map<string, string>();
    for (const [start, end, activityId] of legacyLegs(markup)) {
        if (getActivity(activityId)) {
            activities.set(`${start}|${end}`, activityId);
            activities.set(`${end}|${start}`, activityId);
        }
    }
    if (activities.size === 0) {
        return null;
    }
    const keys = points.map(markupKey);
    const waypoints = [0];
    const legs: LegMark[] = [];
    let i = 0;
    while (i < points.length - 1) {
        let end = -1;
        for (let k = i + 2; k < points.length; k++) {
            if (activities.has(`${keys[i]}|${keys[k]}`)) {
                end = k;
                break;
            }
        }
        if (end < 0) {
            legs.push({ state: 'straight' });
            i += 1;
        } else {
            legs.push({ state: 'routed', activity: activities.get(`${keys[i]}|${keys[end]}`) ?? '' });
            i = end;
        }
        waypoints.push(i);
    }
    return legs.some((leg) => leg.state === 'routed') ? { waypoints, legs } : null;
}

// Запись сессии → треки с разметкой. Строка треков испорчена — то, что из неё прочиталось (как ссылка nktk).
export function legacySessionTracks(data: unknown): GeoData[] {
    const { tracks, routeMarkup } = (data ?? {}) as { tracks?: unknown; routeMarkup?: unknown };
    if (typeof tracks !== 'string' || !tracks) {
        return [];
    }
    return parseNktkSequence(tracks).map((track) => {
        const routes = track.segments.map((segment) => legacyRoute(segment, routeMarkup));
        return routes.some(Boolean) ? { ...track, routes } : track;
    });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Открыть базу старого клиента, не создавая её: open без версии создал бы пустую базу версии 1, поэтому транзакция
// обновления, которая приходит только для новой базы, отменяется — open заканчивается AbortError, база не появляется.
function openExisting(factory: IDBFactory, name: string): Promise<IDBDatabase | null> {
    return new Promise((resolve, reject) => {
        const request = factory.open(name);
        let missing = false;
        request.onupgradeneeded = () => {
            missing = true;
            request.transaction?.abort();
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            if (missing) {
                // ошибка отменённого обновления — не ошибка приложения
                event.preventDefault();
                resolve(null);
                return;
            }
            reject(request.error);
        };
    });
}

// data последней по mtime сессии с треками или undefined (базы, хранилища или сессий с треками нет). Старый клиент
// стирал запись вкладки без треков (clearState), но пустая строка не помешает и здесь.
export async function readLatestLegacySession(
    factory: IDBFactory = indexedDB,
    name = LEGACY_SESSIONS_DB,
): Promise<unknown> {
    const db = await openExisting(factory, name);
    if (!db) {
        return undefined;
    }
    try {
        if (!db.objectStoreNames.contains(STORE)) {
            return undefined;
        }
        const store = db.transaction(STORE, 'readonly').objectStore(STORE);
        const records = await requestResult(
            store.indexNames.contains(MTIME_INDEX) ? store.index(MTIME_INDEX).getAll() : store.getAll(),
        );
        const withTracks = (records as { mtime?: unknown; data?: { tracks?: unknown } }[]).filter(
            (record) => typeof record?.data?.tracks === 'string' && record.data.tracks !== '',
        );
        withTracks.sort((a, b) => Number(b.mtime) - Number(a.mtime));
        return withTracks[0]?.data;
    } finally {
        db.close();
    }
}

// Источник для автосохранения: треки последней сессии старого клиента
export function legacySessionSource(factory?: () => IDBFactory, name?: string): () => Promise<GeoData[]> {
    return async () => legacySessionTracks(await readLatestLegacySession(factory ? factory() : indexedDB, name));
}
