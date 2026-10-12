import type { GeoJSONSourceSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { PROFILE_LAYERS, PROFILE_SOURCES } from '@/elevation/style';
import { EDIT_LAYERS, editSources } from '@/routing/edit-style';
import type { RouteEditState } from '@/state/store';
import type { Track } from '@/tracks/model';
import { TRACK_LAYERS, trackSources } from '@/tracks/style';
import type { LayerDef } from './catalog';
import { CONTOUR_ELEVATION, CONTOUR_LAYER, CONTOUR_LEVEL } from './contours';

// Стиль карты из включённых слоёв: подложка снизу, оверлеи — по порядку наложения каталога, а не по порядку
// включения (titlesByOrder старого клиента). Один источник и один слой на код (у горизонталей ещё подписи), id = код: при смене выбора
// react-maplibre отдаёт новый стиль в setStyle с diff, и источники, которые остались, не перезагружаются.
// Под слоями — серый фон, как у старого клиента: пока тайлы грузятся или подложка сменилась, виден он, а не белая
// страница (решение владельца, change gray-map-background). Треки — над всеми слоями (src/tracks/style.ts), над ними —
// редактируемая линия (src/routing/edit-style.ts); выделенный участок профиля высот — под треками (src/elevation/style.ts). Их источники (overlay) карта собирает сама и мемоизирует отдельно:
// diff стиля MapLibre сравнивает данные GeoJSON всех источников на каждое обновление.
export function overlaySources(
    tracks: readonly Track[] = [],
    edit: { state: RouteEditState | null; color: string; drag: number | null } | null = null,
): Record<string, GeoJSONSourceSpecification> {
    const skip = edit?.state ? { trackId: edit.state.trackId, segment: edit.state.segment } : null;
    return {
        ...trackSources(tracks, skip).sources,
        ...editSources(edit?.state ?? null, edit?.color ?? '', edit?.drag ?? null),
        ...PROFILE_SOURCES,
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
        layers: [BACKGROUND_LAYER, ...sorted.flatMap(layerSpecs), ...PROFILE_LAYERS, ...TRACK_LAYERS, ...EDIT_LAYERS],
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

// Горизонтали (design add-contour-lines, «Вид»). Цвет рыже-коричневый: тёмно-коричневый топокарт не виден на спутнике в
// лесу. Основные толще и подписаны числом без единиц; шрифт — CSS-семейство без glyphs, как у подписей точек треков
// (src/tracks/style.ts)
function contourLayers(code: string, zoom: { minzoom?: number }): LayerSpecification[] {
    return [
        {
            id: code,
            type: 'line',
            source: code,
            'source-layer': CONTOUR_LAYER,
            ...zoom,
            paint: {
                'line-color': 'rgba(200, 105, 30, 0.75)',
                'line-width': ['match', ['get', CONTOUR_LEVEL], 1, 1, 0.5],
            },
        },
        {
            id: `${code}-labels`,
            type: 'symbol',
            source: code,
            'source-layer': CONTOUR_LAYER,
            ...zoom,
            filter: ['>', ['get', CONTOUR_LEVEL], 0],
            layout: {
                'symbol-placement': 'line',
                'text-field': ['to-string', ['get', CONTOUR_ELEVATION]],
                'text-font': ['sans-serif'],
                'text-size': 10,
            },
            paint: {
                'text-color': 'rgb(120, 65, 20)',
                'text-halo-color': 'white',
                'text-halo-width': 1,
            },
        },
    ];
}

// Векторный источник в каталоге один — горизонтали (свои слои растровые). Id подписей с суффиксом не пересекается с
// кодами каталога и своих слоёв (-cs…)
function layerSpecs(layer: LayerDef): LayerSpecification[] {
    const zoom = layer.minZoom === undefined ? {} : { minzoom: layer.minZoom };
    if (layer.source.type === 'vector') {
        return contourLayers(layer.code, zoom);
    }
    if (layer.source.type === 'raster-dem') {
        return [
            {
                id: layer.code,
                type: 'hillshade',
                source: layer.code,
                ...zoom,
                paint: HILLSHADE_PAINT,
            },
        ];
    }
    return [
        {
            id: layer.code,
            type: 'raster',
            source: layer.code,
            ...zoom,
            ...(layer.opacity === undefined ? {} : { paint: { 'raster-opacity': layer.opacity } }),
        },
    ];
}
