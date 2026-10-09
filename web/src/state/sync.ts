import type { LayerDef } from '@/layers/catalog';
import { formatLayersParam, parseLayersParam } from '@/layers/selection';
import { loadSettings, saveSettings } from '@/layers/settings';
import { loadActivity } from '@/routing/activity';
import { formatPlacemark, PLACEMARK_PARAM, type Placemark, parsePlacemark } from '@/search/placemark';
import { isTrackParam, type TrackParam } from '@/tracks/links';
import { formatHash, formatView, parseHash, parseView, type View, withParam } from './hash';
import { type AppStore, createAppStore } from './store';

// Связь стора с адресом и localStorage (design add-web-map-layers, «Адрес»). При старте: адрес → localStorage →
// умолчания. Дальше стор пишет m= (не чаще раза в 300 мс: moveend идёт сериями), l= и r= метки поиска (сразу) через
// history.replaceState — он не шлёт hashchange, поэтому петли нет; hashchange (пользователь правит адрес)
// переводит карту и слои. Параметры треков (nktk, nktl, nktu, nktp, nktj) читаются при старте и на hashchange и сразу
// стираются из адреса, как bindHashStateReadOnly старого клиента; загружает их App (design add-web-tracks, «Стор»).

export interface AddressWindow {
    location: { hash: string; pathname: string; search: string };
    history: { replaceState(data: unknown, unused: string, url: string): void };
    addEventListener(type: 'hashchange', listener: () => void): void;
    removeEventListener(type: 'hashchange', listener: () => void): void;
}

export interface StartOptions {
    catalog: readonly LayerDef[];
    corsProxyUrl: string;
    defaultView: View;
    hash: string;
    storage: Storage | null;
}

export function startAppStore({ catalog, corsProxyUrl, defaultView, hash, storage }: StartOptions): AppStore {
    const params = parseHash(hash);
    const settings = loadSettings(storage, catalog);
    const store = createAppStore({
        catalog,
        corsProxyUrl,
        settings,
        // последний выбор — только если адрес не задаёт годный l= (ниже)
        selection: settings.selection ?? { base: '', overlays: [] },
        view: parseView(params.get('m')) ?? defaultView,
        routingActivity: loadActivity(storage),
        placemark: parsePlacemark(params.get(PLACEMARK_PARAM)),
    });
    const parsed = parseLayersParam(params.get('l'), new Map(catalog.map((layer) => [layer.code, layer])));
    if (parsed) {
        store.getState().applyLayersParam(parsed);
    }
    return store;
}

const VIEW_DEBOUNCE_MS = 300;

// метки сравниваются по виду в адресе: та же метка из адреса не пересоздаётся
function samePlacemark(a: Placemark | null, b: Placemark | null): boolean {
    return (a && formatPlacemark(a).join('/')) === (b && formatPlacemark(b).join('/'));
}

export type TrackParams = [key: TrackParam, values: string[]][];

// fitView — в адресе при старте не было годного m=: карта покажет загруженные треки целиком
export type TrackParamsHandler = (params: TrackParams, fitView: boolean) => void;

export function bindAppStore(
    store: AppStore,
    win: AddressWindow,
    storage: Storage | null,
    onTrackParams: TrackParamsHandler = () => {},
): () => void {
    let viewTimer: ReturnType<typeof setTimeout> | undefined;

    // параметры треков из адреса — и сразу из адреса долой; пустые (`nktk` без `=`) тоже стираются
    function takeTrackParams(): TrackParams {
        let params = parseHash(win.location.hash);
        const found: TrackParams = [];
        let removed = false;
        for (const [key, values] of params) {
            if (isTrackParam(key)) {
                params = withParam(params, key, null);
                removed = true;
                if (values.length) {
                    found.push([key, [...values]]);
                }
            }
        }
        if (removed) {
            win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}#${formatHash(params)}`);
        }
        return found;
    }

    function layersParam() {
        const { selection, layers } = store.getState();
        return formatLayersParam(selection, layers);
    }

    function writeAddress() {
        clearTimeout(viewTimer);
        viewTimer = undefined;
        let params = parseHash(win.location.hash);
        params = withParam(params, 'm', formatView(store.getState().view));
        params = withParam(params, 'l', layersParam());
        const { placemark } = store.getState();
        params = withParam(params, PLACEMARK_PARAM, placemark ? formatPlacemark(placemark) : null);
        const hash = formatHash(params);
        if (hash !== win.location.hash.replace(/^#/u, '')) {
            win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}#${hash}`);
        }
    }

    function persist() {
        const { settings, selection } = store.getState();
        saveSettings(storage, { ...settings, selection });
    }

    function onHashChange() {
        const trackParams = takeTrackParams();
        const params = parseHash(win.location.hash);
        const state = store.getState();
        const view = parseView(params.get('m'));
        if (view && formatView(view).join('/') !== formatView(state.view).join('/')) {
            state.requestView(view);
        }
        const parsed = parseLayersParam(params.get('l'), new Map(state.catalog.map((layer) => [layer.code, layer])));
        if (parsed && params.get('l')?.join('/') !== layersParam().join('/')) {
            state.applyLayersParam(parsed);
        }
        const placemark = parsePlacemark(params.get(PLACEMARK_PARAM));
        if (!samePlacemark(placemark, state.placemark)) {
            state.setPlacemark(placemark);
        }
        // адрес без m= или l= (или с негодными) — вернуть в него текущее состояние
        writeAddress();
        if (trackParams.length) {
            onTrackParams(trackParams, false);
        }
    }

    const unsubscribe = store.subscribe((state, prev) => {
        if (state.selection !== prev.selection || state.layers !== prev.layers) {
            writeAddress();
            persist();
        } else if (state.settings !== prev.settings) {
            persist();
        }
        if (state.placemark !== prev.placemark) {
            writeAddress();
        }
        if (state.view !== prev.view && viewTimer === undefined) {
            viewTimer = setTimeout(writeAddress, VIEW_DEBOUNCE_MS);
        }
    });
    win.addEventListener('hashchange', onHashChange);
    const fitView = parseView(parseHash(win.location.hash).get('m')) === null;
    const trackParams = takeTrackParams();
    // старый клиент сразу пишет m= и l= в адрес — так ссылка из адресной строки всегда полная
    writeAddress();
    persist();
    if (trackParams.length) {
        onTrackParams(trackParams, fitView);
    }

    return () => {
        clearTimeout(viewTimer);
        unsubscribe();
        win.removeEventListener('hashchange', onHashChange);
    };
}
