// Откатывать ли подложку с откатом (BASEMAP_FALLBACKS в selection.ts) по ошибке её источника (спека map-layers, «Откат
// подложки при ошибке тайлов»; design openfreemap-default-basemap). Первая версия откатывала по первой же ошибке тайла,
// и ревью диффа нашло: телефон сменил Wi-Fi на LTE — запросы в полёте падают со статусом 0 (AJAXError MapLibre), и
// цепочка Of → Tt → O проходила до конца, тратя квоту Tracestrack и трафик OSM без всякого сбоя сервиса. Поэтому сразу —
// только то, что значит «сервиса нет»; разовый сбой уже показанной подложки — только если повторяется.

export interface SourceError {
    // ответ сервера; undefined или 0 — ответа нет (сеть, CORS, обрыв)
    status: number | undefined;
    // ошибка тайла; false — ошибка самого источника (описание тайлов TileJSON у Of)
    tile: boolean;
}

// отказ в доступе: нет ключа, квота, лимит, сервис выключен — повтор не поможет
const REFUSED = new Set([401, 403, 429, 503]);
// разовый сбой становится откатом, если за WINDOW_MS повторился COUNT раз и длится не меньше SPREAD_MS: обрыв сети или
// смена сети роняет запросы в полёте одной пачкой, а лежащий сервис отвечает ошибкой и на следующие тайлы
const COUNT = 3;
const SPREAD_MS = 5_000;
const WINDOW_MS = 60_000;

export interface FallbackGate {
    // тайл подложки загрузился: дальше её разовые сбои не откатывают
    tileLoaded(code: string): void;
    shouldFallBack(code: string, error: SourceError): boolean;
}

// now и online — параметры ради unit-тестов (Node без navigator)
export function createFallbackGate(
    now: () => number = Date.now,
    online: () => boolean = () => navigator.onLine,
): FallbackGate {
    const loaded = new Set<string>();
    const failures = new Map<string, number[]>();
    return {
        tileLoaded: (code) => {
            loaded.add(code);
        },
        shouldFallBack: (code, { status, tile }) => {
            // описание тайлов не загрузилось — источника нет, в том числе на 404 (закрытый или переименованный адрес)
            if (!tile) {
                return true;
            }
            // 404 тайла — «тайла нет» в покрытии (растр Tracestrack); векторный 404 MapLibre считает пустым тайлом сам
            if (status === 404) {
                return false;
            }
            if (status !== undefined && REFUSED.has(status)) {
                return true;
            }
            if (!online()) {
                return false;
            }
            // ни одного тайла подложки ещё не было — карта пустая, ждать повторов незачем
            if (!loaded.has(code)) {
                return true;
            }
            const at = now();
            const recent = (failures.get(code) ?? []).filter((time) => at - time <= WINDOW_MS);
            recent.push(at);
            failures.set(code, recent);
            return recent.length >= COUNT && at - recent[0] >= SPREAD_MS;
        },
    };
}
