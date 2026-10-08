import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { LayerDef } from './catalog';

// Стиль карты из включённых слоёв: подложка снизу, оверлеи — по порядку наложения каталога, а не по порядку
// включения (titlesByOrder старого клиента). Один источник и один слой на код, id = код: при смене выбора
// react-maplibre отдаёт новый стиль в setStyle с diff, и источники, которые остались, не перезагружаются.
export function buildStyle(layers: readonly LayerDef[]): StyleSpecification {
    const sorted = [...layers].sort(
        (a, b) => Number(a.isOverlay) - Number(b.isOverlay) || a.order - b.order || a.code.localeCompare(b.code),
    );
    return {
        version: 8,
        sources: Object.fromEntries(sorted.map((layer) => [layer.code, layer.source])),
        layers: sorted.map(layerSpec),
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
