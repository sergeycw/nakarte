import type { GeoJSONSourceSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { EDIT_LAYERS, editSources } from '@/routing/edit-style';
import type { RouteEditState, RoutePreview } from '@/state/store';
import type { Track } from '@/tracks/model';
import { TRACK_LAYERS, trackSources } from '@/tracks/style';
import type { LayerDef } from './catalog';

// Стиль карты из включённых слоёв: подложка снизу, оверлеи — по порядку наложения каталога, а не по порядку
// включения (titlesByOrder старого клиента). Один источник и один слой на код, id = код: при смене выбора
// react-maplibre отдаёт новый стиль в setStyle с diff, и источники, которые остались, не перезагружаются.
// Под слоями — серый фон, как у старого клиента: пока тайлы грузятся или подложка сменилась, виден он, а не белая
// страница (решение владельца, change gray-map-background). Треки — над всеми слоями (src/tracks/style.ts), над ними —
// редактируемая линия (src/routing/edit-style.ts). Их источники (overlay) карта собирает сама и мемоизирует отдельно:
// diff стиля MapLibre сравнивает данные GeoJSON всех источников на каждое обновление.
export function overlaySources(
    tracks: readonly Track[] = [],
    edit: { state: RouteEditState | null; color: string; preview: RoutePreview | null } | null = null,
): Record<string, GeoJSONSourceSpecification> {
    const skip = edit?.state ? { trackId: edit.state.trackId, segment: edit.state.segment } : null;
    return {
        ...trackSources(tracks, skip).sources,
        ...editSources(edit?.state ?? null, edit?.color ?? '', edit?.preview ?? null),
    };
}

function emptyOverlay() {
    return overlaySources();
}

export function buildStyle(
    layers: readonly LayerDef[],
    overlay: Record<string, GeoJSONSourceSpecification> = emptyOverlay(),
): StyleSpecification {
    const sorted = [...layers].sort(
        (a, b) => Number(a.isOverlay) - Number(b.isOverlay) || a.order - b.order || a.code.localeCompare(b.code),
    );
    return {
        version: 8,
        sources: { ...Object.fromEntries(sorted.map((layer) => [layer.code, layer.source])), ...overlay },
        layers: [BACKGROUND_LAYER, ...sorted.map(layerSpec), ...TRACK_LAYERS, ...EDIT_LAYERS],
    };
}

// multidirectional — рекомендация ресёрча new-ui.md («Подложка по умолчанию»): тени с нескольких сторон читаются на
// любой подложке. Подсветка склонов прозрачная: белая по умолчанию высветляет растровую подложку так, что подписи и
// дороги OSM почти не видны (замечание владельца 2026-10-08); остаются только тени.
export const HILLSHADE_PAINT = {
    'hillshade-method': 'multidirectional',
    'hillshade-highlight-color': 'rgba(255, 255, 255, 0)',
    'hillshade-shadow-color': 'rgba(0, 0, 0, 0.4)',
    'hillshade-accent-color': 'rgba(0, 0, 0, 0.2)',
} as const;

// #ddd — фон .leaflet-container в leaflet.css 1.0.3 старого клиента (в src/ не переопределён). id не пересекается с
// кодами слоёв каталога и своих слоёв (-cs…).
export const BACKGROUND_LAYER = {
    id: 'background',
    type: 'background',
    paint: { 'background-color': '#ddd' },
} as const satisfies LayerSpecification;

function layerSpec(layer: LayerDef): LayerSpecification {
    const zoom = layer.minZoom === undefined ? {} : { minzoom: layer.minZoom };
    if (layer.source.type === 'raster-dem') {
        return {
            id: layer.code,
            type: 'hillshade',
            source: layer.code,
            ...zoom,
            paint: HILLSHADE_PAINT,
        };
    }
    return {
        id: layer.code,
        type: 'raster',
        source: layer.code,
        ...zoom,
        ...(layer.opacity === undefined ? {} : { paint: { 'raster-opacity': layer.opacity } }),
    };
}
