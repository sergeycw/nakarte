import { Map as MapLibreMap, type MapRef, NavigationControl } from '@vis.gl/react-maplibre';
import type { RequestTransformFunction } from 'maplibre-gl';
import { type Ref, useCallback, useEffect, useMemo, useRef } from 'react';
import type { LayerDef } from '@/layers/catalog';
import { buildStyle } from '@/layers/style';
import { useAppStore } from '@/state/context';
import { maplibre } from './maplibre';

interface BaseMapProps {
    // тайлы ошибкой: код слоя и HTTP-статус, если он есть
    onTileError: (code: string, status: number | undefined) => void;
    // тесты подменяют адреса тайлов фикстурой (в сеть тесты не ходят)
    transformRequest?: RequestTransformFunction;
    ref?: Ref<MapRef>;
}

// Карта на весь контейнер. isolate: z-index контролов MapLibre (2) остаётся внутри контекста наложения
// карты, и панели приложения лежат над ними без гонки z-index (design add-web-skeleton, «Проверки»).
// Карта неуправляемая: вид пишется в стор по moveend, а запрос из адреса (viewRequest) переводит её jumpTo.
export function BaseMap({ onTileError, transformRequest, ref }: BaseMapProps) {
    const selection = useAppStore((state) => state.selection);
    const layers = useAppStore((state) => state.layers);
    const initialView = useAppStore((state) => state.view);
    const viewRequest = useAppStore((state) => state.viewRequest);
    const setView = useAppStore((state) => state.setView);
    const mapRef = useRef<MapRef | null>(null);
    // react-maplibre отдаёт ссылку, когда карта создана (MapLibre грузится лениво), — после первого рендера,
    // поэтому ссылка наружу — callback-ref, а не useImperativeHandle
    const setMapRef = useCallback(
        (instance: MapRef | null) => {
            mapRef.current = instance;
            if (typeof ref === 'function') {
                ref(instance);
            } else if (ref) {
                ref.current = instance;
            }
        },
        [ref],
    );

    const mapStyle = useMemo(() => {
        const defs = [selection.base, ...selection.overlays]
            .map((code) => layers.get(code))
            .filter((layer): layer is LayerDef => Boolean(layer));
        return buildStyle(defs);
    }, [selection, layers]);

    useEffect(() => {
        if (viewRequest) {
            const { lat, lng, zoom } = viewRequest.view;
            mapRef.current?.jumpTo({ center: [lng, lat], zoom });
        }
    }, [viewRequest]);

    return (
        // кнопки зума MapLibre — под кнопкой слоёв (LayerSwitcher, top-3 right-3, высота 9). С !important: CSS
        // MapLibre подключён вне @layer и без него перебивает утилиту Tailwind своим top: 0
        <div className="absolute inset-0 isolate [&_.maplibregl-ctrl-top-right]:top-12!" data-testid="map">
            <MapLibreMap
                ref={setMapRef}
                mapLib={maplibre}
                initialViewState={{ latitude: initialView.lat, longitude: initialView.lng, zoom: initialView.zoom }}
                mapStyle={mapStyle}
                transformRequest={transformRequest}
                style={{ width: '100%', height: '100%' }}
                onMoveEnd={(event) => {
                    const center = event.target.getCenter().wrap();
                    setView({ lat: center.lat, lng: center.lng, zoom: event.target.getZoom() });
                }}
                onError={(event) => {
                    // ошибка тайла приходит событием карты с sourceId источника (= код слоя) и AJAXError со
                    // status; прочие ошибки — в консоль MapLibre
                    const { sourceId, error } = event as { sourceId?: string; error?: { status?: number } };
                    if (sourceId) {
                        onTileError(sourceId, error?.status);
                    }
                }}
            >
                <NavigationControl position="top-right" />
            </MapLibreMap>
        </div>
    );
}
