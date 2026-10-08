import type { LayerDef } from '@/layers/catalog';
import { formatLayersParam, parseLayersParam } from '@/layers/selection';
import { loadSettings, saveSettings } from '@/layers/settings';
import { formatHash, formatView, parseHash, parseView, type View, withParam } from './hash';
import { type AppStore, createAppStore } from './store';

// Связь стора с адресом и localStorage (design add-web-map-layers, «Адрес»). При старте: адрес → localStorage →
// умолчания. Дальше стор пишет m= (не чаще раза в 300 мс: moveend идёт сериями) и l= (сразу) через
// history.replaceState — он не шлёт hashchange, поэтому петли нет; hashchange (пользователь правит адрес)
// переводит карту и слои.

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
    });
    const parsed = parseLayersParam(params.get('l'), new Map(catalog.map((layer) => [layer.code, layer])));
    if (parsed) {
        store.getState().applyLayersParam(parsed);
    }
    return store;
}

const VIEW_DEBOUNCE_MS = 300;

export function bindAppStore(store: AppStore, win: AddressWindow, storage: Storage | null): () => void {
    let viewTimer: ReturnType<typeof setTimeout> | undefined;

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
        // адрес без m= или l= (или с негодными) — вернуть в него текущее состояние
        writeAddress();
    }

    const unsubscribe = store.subscribe((state, prev) => {
        if (state.selection !== prev.selection || state.layers !== prev.layers) {
            writeAddress();
            persist();
        } else if (state.settings !== prev.settings) {
            persist();
        }
        if (state.view !== prev.view && viewTimer === undefined) {
            viewTimer = setTimeout(writeAddress, VIEW_DEBOUNCE_MS);
        }
    });
    win.addEventListener('hashchange', onHashChange);
    // старый клиент сразу пишет m= и l= в адрес — так ссылка из адресной строки всегда полная
    writeAddress();
    persist();

    return () => {
        clearTimeout(viewTimer);
        unsubscribe();
        win.removeEventListener('hashchange', onHashChange);
    };
}
