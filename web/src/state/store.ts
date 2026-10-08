import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LayerDef } from '@/layers/catalog';
import { type CustomLayerFields, customLayerDef, parseCustomLayerCode, serializeCustomLayer } from '@/layers/custom';
import { type ParsedLayers, validSelection } from '@/layers/selection';
import type { LayerSettings, Selection } from '@/layers/settings';
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

    setView(view: View): void;
    requestView(view: View): void;
    selectBase(code: string): void;
    toggleOverlay(code: string): void;
    applyLayersParam(parsed: ParsedLayers): void;
    updateSettings(patch: Partial<Pick<LayerSettings, 'listed' | 'hotkeys'>>): void;
    // возвращают код слоя
    addCustomLayer(fields: CustomLayerFields): string;
    replaceCustomLayer(code: string, fields: CustomLayerFields): string;
    removeCustomLayer(code: string): void;
}

export type AppStore = StoreApi<AppState>;

export interface AppStoreInit {
    catalog: readonly LayerDef[];
    corsProxyUrl: string;
    settings: LayerSettings;
    selection: Selection;
    view: View;
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
                    if (code in listed) {
                        listed[code] = true;
                    }
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
                            hotkeys: renameKey(settings.hotkeys, oldCode, code),
                        },
                        next,
                    ),
                );
                return code;
            },

            removeCustomLayer: (code) => {
                const { settings, selection } = get();
                const { [code]: _listed, ...listed } = settings.listed;
                const { [code]: _hotkey, ...hotkeys } = settings.hotkeys;
                set(
                    withCustom(
                        { ...settings, listed, hotkeys, custom: settings.custom.filter((c) => c !== code) },
                        selection,
                    ),
                );
            },
        };
    });
}
