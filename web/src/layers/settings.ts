import type { LayerDef } from './catalog';
import { isCustomLayerCode, parseCustomLayerCode, serializeCustomLayer } from './custom';

// Настройки слоёв нового приложения в localStorage. Свой ключ: origin общий со старым клиентом, и его
// leafletLayersSettings мы только читаем — один раз, пока своих настроек нет (design, «Настройки»).

export const STORAGE_KEY = 'nakarte-web:layers';
export const LEGACY_STORAGE_KEY = 'leafletLayersSettings';

export interface Selection {
    base: string;
    // порядок не важен: наложение задаёт каталог
    overlays: string[];
}

export interface LayerSettings {
    // показывать ли слой в переключателе; кода нет — умолчание каталога (isDefault), так новый слой по умолчанию
    // появится и у тех, у кого настройки уже сохранены (как у старого клиента)
    listed: Record<string, boolean>;
    // коды своих слоёв -cs… в порядке добавления
    custom: string[];
    // последний выбор; применяется, если в адресе нет годного l=
    selection: Selection | null;
}

interface StoredSettings extends LayerSettings {
    version: 1;
}

export const EMPTY_SETTINGS: LayerSettings = { listed: {}, custom: [], selection: null };

// Свой слой в настройках и ссылках хранится каноничным кодом: старый клиент перекодировал код при загрузке
// (upgrade isTop), и сравнение дубликатов идёт по коду
export function canonicalCustomCode(code: string): string | null {
    const fields = parseCustomLayerCode(code);
    return fields ? serializeCustomLayer(fields) : null;
}

function readStorage(storage: Storage, key: string): unknown {
    try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        // нет хранилища (приватный режим, запрет сайта) или битый JSON — как будто настроек нет
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOwn(raw: unknown): LayerSettings | null {
    if (!isRecord(raw) || raw.version !== 1) {
        return null;
    }
    const selection = isRecord(raw.selection) && typeof raw.selection.base === 'string' ? raw.selection : null;
    return {
        listed: isRecord(raw.listed) ? (raw.listed as Record<string, boolean>) : {},
        custom: Array.isArray(raw.custom) ? raw.custom.filter((code) => typeof code === 'string') : [],
        selection: selection
            ? {
                  base: selection.base as string,
                  overlays: Array.isArray(selection.overlays)
                      ? selection.overlays.filter((code) => typeof code === 'string')
                      : [],
              }
            : null,
    };
}

// leafletLayersSettings старого клиента: {layers: [{code, isCustom, enabled, hotkey}]} (saveSettings в
// leaflet.control.layers.configure). Коды удалённых слоёв пропускаются; hotkey не переносится: хоткеев слоёв
// в новом приложении нет (решение владельца, design add-web-map-layers).
function parseLegacy(raw: unknown, isKnown: (code: string) => boolean): LayerSettings | null {
    if (!isRecord(raw) || !Array.isArray(raw.layers)) {
        return null;
    }
    const settings: LayerSettings = { listed: {}, custom: [], selection: null };
    for (const item of raw.layers) {
        if (!isRecord(item) || typeof item.code !== 'string') {
            continue;
        }
        let code: string | null = item.code;
        if (item.isCustom || isCustomLayerCode(code)) {
            code = canonicalCustomCode(code);
            if (!code || settings.custom.includes(code)) {
                continue;
            }
            settings.custom.push(code);
        } else if (!isKnown(code)) {
            continue;
        }
        if (typeof item.enabled === 'boolean') {
            settings.listed[code] = item.enabled;
        }
    }
    return settings;
}

export function loadSettings(storage: Storage | null, catalog: readonly LayerDef[]): LayerSettings {
    if (!storage) {
        return EMPTY_SETTINGS;
    }
    const known = new Set(catalog.map((layer) => layer.code));
    return (
        parseOwn(readStorage(storage, STORAGE_KEY)) ??
        parseLegacy(readStorage(storage, LEGACY_STORAGE_KEY), (code) => known.has(code)) ??
        EMPTY_SETTINGS
    );
}

export function saveSettings(storage: Storage | null, settings: LayerSettings): void {
    const stored: StoredSettings = { version: 1, ...settings };
    try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
        // переполнение или запрет хранилища: настройки живут до перезагрузки
    }
}

export function isListed(layer: LayerDef, settings: LayerSettings): boolean {
    // свой слой пользователь добавил сам — он в списке, пока его не скрыли
    return settings.listed[layer.code] ?? (isCustomLayerCode(layer.code) || layer.isDefault);
}
