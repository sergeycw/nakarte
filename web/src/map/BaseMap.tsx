import { Map as MapLibreMap, type MapRef, Marker, NavigationControl } from '@vis.gl/react-maplibre';
import { LoaderCircleIcon } from 'lucide-react';
import type { RequestTransformFunction } from 'maplibre-gl';
import { type Ref, useCallback, useEffect, useMemo, useRef } from 'react';
import type { LayerDef } from '@/layers/catalog';
import { buildStyle } from '@/layers/style';
import { editSources } from '@/routing/edit-style';
import { MapEditor } from '@/routing/MapEditor';
import { useAppStore } from '@/state/context';
import { TRACK_COLORS } from '@/tracks/model';
import { trackSources } from '@/tracks/style';
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
    const boundsRequest = useAppStore((state) => state.boundsRequest);
    const tracks = useAppStore((state) => state.tracks);
    const routeEdit = useAppStore((state) => state.routeEdit);
    const routePreview = useAppStore((state) => state.routePreview);
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

    // Источники треков и редактора собираются отдельно: перетаскивание и резинка меняют только источники редактора,
    // треки пересобираются при смене треков или редактируемого отрезка (design add-web-route-editor, «Отрисовка»)
    const editTrackId = routeEdit?.trackId;
    const editSegment = routeEdit?.segment;
    const trackData = useMemo(
        () =>
            trackSources(
                tracks,
                editTrackId === undefined || editSegment === undefined
                    ? null
                    : { trackId: editTrackId, segment: editSegment },
            ),
        [tracks, editTrackId, editSegment],
    );
    const editColorIndex = tracks.find((track) => track.id === editTrackId)?.color ?? 0;
    const editData = useMemo(
        () => editSources(routeEdit, TRACK_COLORS[editColorIndex], routePreview),
        [routeEdit, editColorIndex, routePreview],
    );
    const mapStyle = useMemo(() => {
        const defs = [selection.base, ...selection.overlays]
            .map((code) => layers.get(code))
            .filter((layer): layer is LayerDef => Boolean(layer));
        return buildStyle(defs, { ...trackData.sources, ...editData });
    }, [selection, layers, trackData, editData]);

    useEffect(() => {
        if (viewRequest) {
            const { lat, lng, zoom } = viewRequest.view;
            mapRef.current?.jumpTo({ center: [lng, lat], zoom });
        }
    }, [viewRequest]);

    // Запрос «показать границы» может прийти до того, как карта создана (треки из адреса грузятся при старте, а
    // MapLibre — лениво): тогда его применяет onLoad. appliedBounds — чтобы не применить один запрос дважды.
    const appliedBounds = useRef(0);
    const fitRequestedBounds = useCallback(() => {
        const map = mapRef.current;
        if (!map || !boundsRequest || appliedBounds.current === boundsRequest.seq) {
            return;
        }
        appliedBounds.current = boundsRequest.seq;
        const { west, south, east, north } = boundsRequest.bounds;
        // maxZoom 16 старого клиента (setViewToBounds) — в зуме MapLibre на 1 меньше
        map.fitBounds(
            [
                [west, south],
                [east, north],
            ],
            { maxZoom: 15, padding: 40, duration: 0 },
        );
    }, [boundsRequest]);
    useEffect(fitRequestedBounds, [fitRequestedBounds]);

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
                onLoad={fitRequestedBounds}
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
                <MapEditor />
                {/* спиннер посередине ожидающего отрезка (спека route-editing, «Разрыв со спиннером»): маркеров
                    единицы, а анимация CSS проще символьного слоя */}
                {trackData.pending.map((point, i) => (
                    <Marker
                        // biome-ignore lint/suspicious/noArrayIndexKey: у двух ожидающих отрезков может быть одна середина
                        key={`${point.lat},${point.lng},${i}`}
                        longitude={point.lng}
                        latitude={point.lat}
                        style={{ pointerEvents: 'none' }}
                    >
                        <LoaderCircleIcon
                            className="size-5 animate-spin rounded-full bg-white/70 text-blue-600"
                            data-testid="route-spinner"
                        />
                    </Marker>
                ))}
            </MapLibreMap>
        </div>
    );
}
