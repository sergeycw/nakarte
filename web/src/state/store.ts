import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Elevation, ProfileSamples } from '@/elevation/profile';
import type { LayerDef } from '@/layers/catalog';
import { type CustomLayerFields, customLayerDef, parseCustomLayerCode, serializeCustomLayer } from '@/layers/custom';
import { FALLBACK_BASE, type ParsedLayers, validSelection } from '@/layers/selection';
import type { LayerSettings, Selection } from '@/layers/settings';
import type { End } from '@/routing/editor';
import type { RouteLine } from '@/routing/line';
import type { LinePlace } from '@/routing/line-tools';
import type { Placemark } from '@/search/placemark';
import type { PanoView } from '@/streetview/hash';
import type { Bounds } from '@/tracks/geometry';
import { type GeoData, type LatLng, TRACK_COLORS, type Track, type Waypoint } from '@/tracks/model';
import type { View } from './hash';

// Состояние приложения, которое делят карта, переключатель слоёв и адрес. Стор создаётся на каждый экземпляр App
// (контекст), а не модульным синглтоном: browser-тесты рендерят App много раз в одной странице.

export interface AppState {
    catalog: readonly LayerDef[];
    // каталог + свои слои; пересобирается при изменении своих слоёв
    layers: ReadonlyMap<string, LayerDef>;
    settings: LayerSettings;
    selection: Selection;
    // с какой подложки карта откатилась на FALLBACK_BASE после ошибки её тайлов (design add-outdoor-basemap, «Откат на
    // OpenStreetMap»): откат — не выбор пользователя, в localStorage и l= уходит выбор с ней (savedSelection)
    basemapFallback: string | null;
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
    // текст, который не удалось положить в буфер обмена (ссылка на треки, координаты точки): показывается окном
    copyFallback: CopyFallback | null;
    // прокладка (design add-web-route-editor, «Связь со стором и картой»): выбранная активность или null («Off»),
    // жив ли роутер (красная кнопка), редактируемая линия и номер перетаскиваемой опорной точки — то, что рисует
    // карта. Само превью перетаскивания и резинку карта рисует в обход стора (routing/MapEditor.tsx).
    routingActivity: string | null;
    routerReachable: boolean;
    routeEdit: RouteEditState | null;
    routeDrag: number | null;
    // инструменты линии и точки трека (design add-web-line-tools): выбор на карте для Join и Shortcut, меню в точке
    // карты, режим постановки или переноса точки трека и окно её названия
    lineTool: LineTool | null;
    mapMenu: MapMenu | null;
    pointTool: PointTool | null;
    pointDialog: PointDialog | null;
    // профиль высот (design add-web-elevation-profile): что показано, выборка и высоты, курсор и выделение — дробные
    // номера точек выборки; курсор и выделение делят панель и карта
    profile: ProfileTarget | null;
    profileData: ProfileData | null;
    profileCursor: number | null;
    profileSelection: readonly [number, number] | null;
    // метка найденного места (design add-web-search-panoramas, «Метка»): живёт в адресе r=
    placemark: Placemark | null;
    // Street View (design add-web-search-panoramas, «Street View: режим, клик, окно»): режим, показанная панорама (панель
    // открыта, пока она есть; пишет окно панорамы) и запрос окну перейти к виду (клик по карте, адрес)
    streetView: StreetViewState;

    setView(view: View): void;
    requestView(view: View): void;
    selectBase(code: string): void;
    // откатить подложку code на FALLBACK_BASE; false — code уже не подложка (ошибки тайлов приходят и после смены слоя)
    fallBackBase(code: string): boolean;
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
        patch: Partial<
            Pick<Track, 'name' | 'color' | 'visible' | 'segments' | 'points' | 'routes' | 'measureTicksShown'>
        >,
    ): void;
    removeTracks(ids: readonly string[]): void;
    changeLoadingTracks(delta: number): void;
    setCopyFallback(fallback: CopyFallback | null): void;
    setRoutingActivity(id: string | null): void;
    setRouterReachable(reachable: boolean): void;
    setRouteEdit(edit: RouteEditState | null): void;
    setRouteDrag(index: number | null): void;
    setLineTool(tool: LineTool | null): void;
    setMapMenu(menu: MapMenu | null): void;
    setPointTool(tool: PointTool | null): void;
    setPointDialog(dialog: PointDialog | null): void;
    setProfile(profile: ProfileTarget | null): void;
    setProfileData(data: ProfileData | null): void;
    setProfileCursor(cursor: number | null): void;
    setProfileSelection(selection: readonly [number, number] | null): void;
    setPlacemark(placemark: Placemark | null): void;
    // выключение режима закрывает панораму
    setStreetViewEnabled(enabled: boolean): void;
    // открыть панораму в этом виде (или перевести открытую)
    requestPano(view: PanoView): void;
    // окно панорамы сообщает текущий вид; null — панорама закрыта
    setPano(view: PanoView | null): void;
}

export interface StreetViewState {
    enabled: boolean;
    pano: PanoView | null;
    request: { view: PanoView; seq: number } | null;
}

// segment null — профиль всего трека
export interface ProfileTarget {
    trackId: string;
    segment: number | null;
}

// values — высоты точек выборки (null — нет данных), пока высот нет — null. updating — идёт перестроение: виден
// прежний профиль. error — причина ошибки API высот.
export interface ProfileData {
    samples: ProfileSamples;
    values: readonly Elevation[] | null;
    updating: boolean;
    error: string | null;
}

// Выбор на карте: Join от конца редактируемой линии, Shortcut от места на ней
export type LineTool = { kind: 'join'; end: End } | { kind: 'shortcut'; from: LinePlace };

// Что под меню: опорная точка или место на линии редактируемого отрезка, точка трека
export type MenuTarget =
    | { kind: 'waypoint'; index: number }
    | { kind: 'line'; place: { leg: number; latlng: LatLng } }
    | { kind: 'point'; trackId: string; point: Waypoint };

// x, y — экранные координаты (clientX/clientY), в них встаёт меню
export interface MapMenu {
    x: number;
    y: number;
    target: MenuTarget;
}

// Точка трека — объект Waypoint из стора, а не номер: номер ищется в момент действия, пропавшая точка — ничего
export type PointTool = { kind: 'add'; trackId: string } | { kind: 'move'; trackId: string; point: Waypoint };

export interface CopyFallback {
    title: string;
    text: string;
}

export interface PointDialog {
    trackId: string;
    point: Waypoint;
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
    placemark?: Placemark | null;
    streetView?: { enabled: boolean; pano: PanoView | null };
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
            basemapFallback: null,
            view: init.view,
            viewRequest: null,
            boundsRequest: null,
            tracks: [],
            nextColor: 0,
            loadingTracks: 0,
            copyFallback: null,
            routingActivity: init.routingActivity ?? null,
            routerReachable: true,
            routeEdit: null,
            routeDrag: null,
            lineTool: null,
            mapMenu: null,
            pointTool: null,
            pointDialog: null,
            profile: null,
            profileData: null,
            profileCursor: null,
            profileSelection: null,
            placemark: init.placemark ?? null,
            streetView: {
                enabled: init.streetView?.enabled ?? false,
                pano: init.streetView?.pano ?? null,
                request: init.streetView?.pano ? { view: init.streetView.pano, seq: 1 } : null,
            },

            setView: (view) => set({ view }),
            requestView: (view) => set({ view, viewRequest: { view, seq: (get().viewRequest?.seq ?? 0) + 1 } }),

            selectBase: (code) => {
                const { selection, layers } = get();
                if (layers.get(code)?.isOverlay !== false) {
                    return;
                }
                // явный выбор подложки отката — уже выбор пользователя: откат сбрасывается, хотя подложка та же
                if (selection.base === code) {
                    if (get().basemapFallback) {
                        set({ basemapFallback: null });
                    }
                    return;
                }
                set({ selection: { ...selection, base: code }, basemapFallback: null });
            },

            fallBackBase: (code) => {
                const { selection } = get();
                if (selection.base !== code || code === FALLBACK_BASE) {
                    return false;
                }
                set({ selection: { ...selection, base: FALLBACK_BASE }, basemapFallback: code });
                return true;
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
                set({ ...withCustom({ ...settings, listed, custom: merged }, selection), basemapFallback: null });
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
            setCopyFallback: (copyFallback) => set({ copyFallback }),
            setRoutingActivity: (routingActivity) => set({ routingActivity }),
            setRouterReachable: (routerReachable) => set({ routerReachable }),
            setRouteEdit: (routeEdit) => set({ routeEdit }),
            setRouteDrag: (routeDrag) => set({ routeDrag }),
            setLineTool: (lineTool) => set({ lineTool }),
            setMapMenu: (mapMenu) => set({ mapMenu }),
            setPointTool: (pointTool) => set({ pointTool }),
            setPointDialog: (pointDialog) => set({ pointDialog }),
            setProfile: (profile) => set({ profile, profileData: null, profileCursor: null, profileSelection: null }),
            setProfileData: (profileData) => set({ profileData }),
            setProfileCursor: (profileCursor) => set({ profileCursor }),
            setProfileSelection: (profileSelection) => set({ profileSelection }),
            setPlacemark: (placemark) => set({ placemark }),
            setStreetViewEnabled: (enabled) => {
                const { streetView } = get();
                if (streetView.enabled === enabled) {
                    return;
                }
                set({ streetView: enabled ? { ...streetView, enabled } : { enabled, pano: null, request: null } });
            },
            requestPano: (view) => {
                const { streetView } = get();
                set({
                    streetView: {
                        enabled: true,
                        pano: view,
                        request: { view, seq: (streetView.request?.seq ?? 0) + 1 },
                    },
                });
            },
            setPano: (pano) => {
                const { streetView } = get();
                if (!streetView.enabled) {
                    return;
                }
                set({ streetView: { ...streetView, pano, request: pano ? streetView.request : null } });
            },

            removeCustomLayer: (code) => {
                const { settings, selection } = get();
                const { [code]: _listed, ...listed } = settings.listed;
                set(withCustom({ ...settings, listed, custom: settings.custom.filter((c) => c !== code) }, selection));
            },
        };
    });
}

// Выбор для localStorage и l=: пока карта стоит на подложке отката, сохраняется подложка, с которой откатились, —
// следующий заход и перезагрузка снова попробуют её. Другая подложка (свой слой, удаление подложки) значит, что откат уже ни при чём
export function savedSelection(state: Pick<AppState, 'selection' | 'basemapFallback'>): Selection {
    const { selection, basemapFallback } = state;
    if (!basemapFallback || selection.base !== FALLBACK_BASE) {
        return selection;
    }
    return { ...selection, base: basemapFallback };
}
