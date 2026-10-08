import type { LayerDef } from './catalog';
import { isCustomLayerCode, parseCustomLayerCode } from './custom';
import { canonicalCustomCode, type Selection } from './settings';

// Подложка по умолчанию — OpenStreetMap, как первый слой списка старого клиента (record-new-ui-decisions)
export const DEFAULT_SELECTION: Selection = { base: 'O', overlays: [] };

export interface ParsedLayers {
    selection: Selection;
    // свои слои из ссылки (каноничные коды): их надо добавить в список, если их там ещё нет
    custom: string[];
}

// l= старых ссылок по правилам unserializeState старого клиента (leaflet.hashState/Leaflet.Control.Layers.js и
// leaflet.control.layers.configure): неизвестные коды и коды удалённых слоёв пропускаются; если среди кодов нет
// ни одной подложки, l= игнорируется целиком. Из нескольких подложек берётся первая (нижняя).
export function parseLayersParam(
    values: readonly string[] | undefined,
    catalog: ReadonlyMap<string, LayerDef>,
): ParsedLayers | null {
    if (!values?.length) {
        return null;
    }
    let base: string | null = null;
    const overlays: string[] = [];
    const custom: string[] = [];
    for (const value of values) {
        let code: string | null = value;
        let isOverlay: boolean;
        if (isCustomLayerCode(value)) {
            code = canonicalCustomCode(value);
            const fields = code ? parseCustomLayerCode(code) : null;
            if (!code || !fields) {
                continue;
            }
            if (!custom.includes(code)) {
                custom.push(code);
            }
            isOverlay = fields.isOverlay;
        } else {
            const layer = catalog.get(value);
            if (!layer) {
                continue;
            }
            isOverlay = layer.isOverlay;
        }
        if (!isOverlay) {
            base ??= code;
        } else if (!overlays.includes(code)) {
            overlays.push(code);
        }
    }
    return base ? { selection: { base, overlays }, custom } : null;
}

// Сохранённый выбор мог сослаться на слой, которого больше нет (удалённый свой слой, старый код)
export function validSelection(selection: Selection | null, layers: ReadonlyMap<string, LayerDef>): Selection {
    if (!selection) {
        return DEFAULT_SELECTION;
    }
    const base = layers.get(selection.base);
    return {
        base: base && !base.isOverlay ? base.code : DEFAULT_SELECTION.base,
        overlays: [...new Set(selection.overlays)].filter((code) => layers.get(code)?.isOverlay),
    };
}

// l= для адреса: коды снизу вверх, как serializeState старого клиента (по zIndex слоёв)
export function formatLayersParam(selection: Selection, layers: ReadonlyMap<string, LayerDef>): string[] {
    const overlays = selection.overlays
        .map((code) => layers.get(code))
        .filter((layer): layer is LayerDef => Boolean(layer))
        .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
        .map((layer) => layer.code);
    return [selection.base, ...overlays];
}
