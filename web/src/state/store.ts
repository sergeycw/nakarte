import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LayerDef } from '@/layers/catalog';
import { type CustomLayerFields, customLayerDef, parseCustomLayerCode, serializeCustomLayer } from '@/layers/custom';
import { type ParsedLayers, validSelection } from '@/layers/selection';
import type { LayerSettings, Selection } from '@/layers/settings';
import type { End } from '@/routing/editor';
import type { RouteLine } from '@/routing/line';
import type { Bounds } from '@/tracks/geometry';
import { type GeoData, TRACK_COLORS, type Track } from '@/tracks/model';
import type { View } from './hash';

// Состояние приложения, которое делят карта, переключатель слоёв и адрес. Стор создаётся на каждый экземпляр App
// (контекст), а не модульным синглтоном: browser-тесты рендерят App много раз в одной странице.

export interface AppState {
    catalog: readonly LayerDef[];
    // каталог + свои слои; пересобирается при изменении своих слоёв
    layers: ReadonlyMap<string, LayerDef>;
    settings: LayerSettings;
    selection: Selection;
    // последний вид карты (пишет карта по moveend)
    view: View;
    // вид, на который карту надо перевести (пришёл из адреса); seq различает одинаковые запросы
    viewRequest: { view: View; seq: number } | null;
    // границы, которые карта должна показать целиком (трек, загруженные треки)
    boundsRequest: { bounds: Bounds; seq: number } | null;
    // список треков сверху вниз (design add-web-tracks, «Стор»)
    tracks: readonly Track[];
    // цвет следующего трека без своего цвета — по кругу, как _lastTrackColor старого клиента
    nextColor: number;
    // сколько загрузок треков (файлы, ссылки, параметры адреса) идёт сейчас
    loadingTracks: number;
    // ссылка на треки, которую не удалось положить в буфер обмена: показывается окном
    sharedLink: string | null;
    // прокладка (design add-web-route-editor, «Связь со стором и картой»): выбранная активность или null («Off»),
    // жив ли роутер (красная кнопка), редактируемая линия и номер перетаскиваемой опорной точки — то, что рисует
    // карта. Само превью перетаскивания и резинку карта рисует в обход стора (routing/MapEditor.tsx).
    routingActivity: string | null;
    routerReachable: boolean;
    routeEdit: RouteEditState | null;
    routeDrag: number | null;

    setView(view: View): void;
    requestView(view: View): void;
    selectBase(code: string): void;
    toggleOverlay(code: string): void;
    applyLayersParam(parsed: ParsedLayers): void;
    updateSettings(patch: Partial<Pick<LayerSettings, 'listed'>>): void;
    // возвращают код слоя
    addCustomLayer(fields: CustomLayerFields): string;
    replaceCustomLayer(code: string, fields: CustomLayerFields): string;
    removeCustomLayer(code: string): void;
    requestBounds(bounds: Bounds): void;
    // данные уже подготовлены prepareImport (линии упрощены); возвращает добавленные треки. atStart — в начало списка
    // (восстановленный рабочий набор, design add-web-autosave, «Восстановление и треки из адреса»)
    addTracks(data: readonly GeoData[], atStart?: boolean): Track[];
    // новые segments без routes сбрасывают разметку маршрута: правка, которая о ней не знает, не оставит номера опорных
    // точек, указывающие не туда (design add-web-route-editor, «Разметка маршрута в треке»)
    updateTrack(
        id: string,
        patch: Partial<Pick<Track, 'name' | 'color' | 'visible' | 'segments' | 'points' | 'routes'>>,
    ): void;
    removeTracks(ids: readonly string[]): void;
    changeLoadingTracks(delta: number): void;
    setSharedLink(link: string | null): void;
    setRoutingActivity(id: string | null): void;
    setRouterReachable(reachable: boolean): void;
    setRouteEdit(edit: RouteEditState | null): void;
    setRouteDrag(index: number | null): void;
}

export interface RouteEditState {
    trackId: string;
    segment: number;
    line: RouteLine;
    // рисование: новые точки ставятся кликом к этому концу линии
    drawing: End | null;
    canUndo: boolean;
    canRedo: boolean;
}

export type AppStore = StoreApi<AppState>;

export interface AppStoreInit {
    catalog: readonly LayerDef[];
    corsProxyUrl: string;
    settings: LayerSettings;
    selection: Selection;
    view: View;
    routingActivity?: string | null;
}

function layersMap(catalog: readonly LayerDef[], custom: readonly string[], corsProxyUrl: string) {
    const layers = new Map(catalog.map((layer) => [layer.code, layer]));
    for (const code of custom) {
        const fields = parseCustomLayerCode(code);
        if (fields) {
            layers.set(code, customLayerDef(code, fields, corsProxyUrl));
        }
    }
    return layers;
}

function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
    if (!(from in record)) {
        return record;
    }
    const { [from]: value, ...rest } = record;
    return { ...rest, [to]: value };
}

// id треков уникальны на страницу (и между экземплярами стора в browser-тестах — не мешает)
let lastTrackId = 0;

export function createAppStore(init: AppStoreInit): AppStore {
    return createStore<AppState>()((set, get) => {
        // свои слои поменялись — пересобрать карту слоёв и отбросить из выбора пропавшие
        function withCustom(settings: LayerSettings, selection: Selection) {
            const layers = layersMap(init.catalog, settings.custom, init.corsProxyUrl);
            return { settings, layers, selection: validSelection(selection, layers) };
        }

        const initial = withCustom(init.settings, init.selection);
        return {
            catalog: init.catalog,
            ...initial,
            view: init.view,
            viewRequest: null,
            boundsRequest: null,
            tracks: [],
            nextColor: 0,
            loadingTracks: 0,
            sharedLink: null,
            routingActivity: init.routingActivity ?? null,
            routerReachable: true,
            routeEdit: null,
            routeDrag: null,

            setView: (view) => set({ view }),
            requestView: (view) => set({ view, viewRequest: { view, seq: (get().viewRequest?.seq ?? 0) + 1 } }),

            selectBase: (code) => {
                const { selection, layers } = get();
                if (layers.get(code)?.isOverlay !== false || selection.base === code) {
                    return;
                }
                set({ selection: { ...selection, base: code } });
            },

            toggleOverlay: (code) => {
                const { selection, layers } = get();
                if (!layers.get(code)?.isOverlay) {
                    return;
                }
                const overlays = selection.overlays.includes(code)
                    ? selection.overlays.filter((item) => item !== code)
                    : [...selection.overlays, code];
                set({ selection: { ...selection, overlays } });
            },

            // l= из адреса: свои слои из ссылки попадают в список, а все слои ссылки становятся видимыми в
            // переключателе — как unserializeState старого клиента (layer.enabled = true)
            applyLayersParam: ({ selection, custom }) => {
                const { settings } = get();
                const listed = { ...settings.listed };
                for (const code of [selection.base, ...selection.overlays]) {
                    listed[code] = true;
                }
                const merged = [...settings.custom, ...custom.filter((code) => !settings.custom.includes(code))];
                set(withCustom({ ...settings, listed, custom: merged }, selection));
            },

            updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

            addCustomLayer: (fields) => {
                const code = serializeCustomLayer(fields);
                const { settings, selection } = get();
                const custom = settings.custom.includes(code) ? settings.custom : [...settings.custom, code];
                // новый слой сразу включён: подложка заменяет текущую, оверлей добавляется
                const next = fields.isOverlay
                    ? { ...selection, overlays: [...selection.overlays.filter((item) => item !== code), code] }
                    : { ...selection, base: code };
                set(withCustom({ ...settings, custom, listed: { ...settings.listed, [code]: true } }, next));
                return code;
            },

            replaceCustomLayer: (oldCode, fields) => {
                const code = serializeCustomLayer(fields);
                const { settings, selection } = get();
                const custom = settings.custom.map((item) => (item === oldCode ? code : item));
                const wasBase = selection.base === oldCode;
                const wasOverlay = selection.overlays.includes(oldCode);
                // пустая подложка — validSelection вернёт умолчание
                const next = {
                    base: wasBase ? '' : selection.base,
                    overlays: selection.overlays.filter((item) => item !== oldCode),
                };
                // включённый слой остаётся включённым в новой роли, кроме оверлея, ставшего подложкой
                // (onCustomLayerChangeClicked старого клиента)
                if (wasBase || (wasOverlay && fields.isOverlay)) {
                    if (fields.isOverlay) {
                        next.overlays.push(code);
                    } else {
                        next.base = code;
                    }
                }
                set(
                    withCustom(
                        {
                            ...settings,
                            custom: [...new Set(custom)],
                            listed: renameKey(settings.listed, oldCode, code),
                        },
                        next,
                    ),
                );
                return code;
            },

            requestBounds: (bounds) => set({ boundsRequest: { bounds, seq: (get().boundsRequest?.seq ?? 0) + 1 } }),

            addTracks: (data, atStart = false) => {
                let { nextColor } = get();
                const added = data.map((item): Track => {
                    let color = item.color;
                    if (
                        !(Number.isInteger(color) && (color as number) >= 0 && (color as number) < TRACK_COLORS.length)
                    ) {
                        color = nextColor;
                        nextColor = (nextColor + 1) % TRACK_COLORS.length;
                    }
                    lastTrackId += 1;
                    return {
                        id: `track-${lastTrackId}`,
                        name: item.name,
                        segments: item.segments,
                        points: item.points,
                        color: color as number,
                        visible: !item.hidden,
                        measureTicksShown: item.measureTicksShown ?? false,
                        ...(item.routes ? { routes: item.routes } : {}),
                    };
                });
                set({ tracks: atStart ? [...added, ...get().tracks] : [...get().tracks, ...added], nextColor });
                return added;
            },

            updateTrack: (id, patch) => {
                const reset = 'segments' in patch && !('routes' in patch) ? { routes: undefined } : {};
                set({
                    tracks: get().tracks.map((track) => (track.id === id ? { ...track, ...reset, ...patch } : track)),
                });
            },

            removeTracks: (ids) => set({ tracks: get().tracks.filter((track) => !ids.includes(track.id)) }),

            changeLoadingTracks: (delta) => set({ loadingTracks: get().loadingTracks + delta }),
            setSharedLink: (sharedLink) => set({ sharedLink }),
            setRoutingActivity: (routingActivity) => set({ routingActivity }),
            setRouterReachable: (routerReachable) => set({ routerReachable }),
            setRouteEdit: (routeEdit) => set({ routeEdit }),
            setRouteDrag: (routeDrag) => set({ routeDrag }),

            removeCustomLayer: (code) => {
                const { settings, selection } = get();
                const { [code]: _listed, ...listed } = settings.listed;
                set(withCustom({ ...settings, listed, custom: settings.custom.filter((c) => c !== code) }, selection));
            },
        };
    });
}
