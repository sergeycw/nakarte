import { Map as MapLibreMap, type MapRef, Marker } from '@vis.gl/react-maplibre';
import { LoaderCircleIcon } from 'lucide-react';
import type { RequestTransformFunction } from 'maplibre-gl';
import { type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef } from 'react';
import { ProfileOnMap } from '@/elevation/ProfileOnMap';
import { PROFILE_SOURCES } from '@/elevation/style';
import type { LayerDef } from '@/layers/catalog';
import { buildStyle } from '@/layers/style';
import { editSources } from '@/routing/edit-style';
import { MapEditor } from '@/routing/MapEditor';
import { PlacemarkOnMap } from '@/search/PlacemarkOnMap';
import { useAppStore } from '@/state/context';
import { COVERAGE_LAYER } from '@/streetview/coverage';
import { StreetViewOnMap } from '@/streetview/StreetViewOnMap';
import { TRACK_COLORS } from '@/tracks/model';
import { TRACK_TICKS, trackSources } from '@/tracks/style';
import { ticksData } from '@/tracks/ticks';
import { maplibre } from './maplibre';

interface BaseMapProps {
    // тайлы ошибкой: код слоя и HTTP-статус, если он есть
    onTileError: (code: string, status: number | undefined) => void;
    // тесты подменяют адреса тайлов фикстурой (в сеть тесты не ходят)
    transformRequest?: RequestTransformFunction;
    ref?: Ref<MapRef>;
    // контролы и слои поверх карты из App (кнопки карты)
    children?: ReactNode;
}

// Карта на весь контейнер. isolate: z-index контролов MapLibre (2) остаётся внутри контекста наложения
// карты, и панели приложения лежат над ними без гонки z-index (design add-web-skeleton, «Проверки»).
// Карта неуправляемая: вид пишется в стор по moveend, а запрос из адреса (viewRequest) переводит её jumpTo.
export function BaseMap({ onTileError, transformRequest, ref, children }: BaseMapProps) {
    const selection = useAppStore((state) => state.selection);
    const layers = useAppStore((state) => state.layers);
    const initialView = useAppStore((state) => state.view);
    const viewRequest = useAppStore((state) => state.viewRequest);
    const boundsRequest = useAppStore((state) => state.boundsRequest);
    const tracks = useAppStore((state) => state.tracks);
    const routeEdit = useAppStore((state) => state.routeEdit);
    const routeDrag = useAppStore((state) => state.routeDrag);
    const setView = useAppStore((state) => state.setView);
    const streetViewOn = useAppStore((state) => state.streetView.enabled);
    // отметки расстояния пересобираются на целом зуме (design add-web-search-panoramas, «Отметки расстояния и линейка»)
    // floor, а не round: на дробном зуме шаг считается по меньшему масштабу, отметки не ближе 15 мм
    const ticksZoom = useAppStore((state) => Math.floor(state.view.zoom));
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
        () => editSources(routeEdit, TRACK_COLORS[editColorIndex], routeDrag),
        [routeEdit, editColorIndex, routeDrag],
    );
    const ticks = useMemo(() => ticksData(tracks, ticksZoom), [tracks, ticksZoom]);
    const mapStyle = useMemo(() => {
        const defs = [selection.base, ...selection.overlays]
            .map((code) => layers.get(code))
            .filter((layer): layer is LayerDef => Boolean(layer));
        // покрытие Street View — над слоями каталога, под профилем и треками (design add-web-search-panoramas)
        if (streetViewOn) {
            defs.push(COVERAGE_LAYER);
        }
        return buildStyle(defs, {
            ...trackData.sources,
            [TRACK_TICKS]: { type: 'geojson', data: ticks },
            ...editData,
            ...PROFILE_SOURCES,
        });
    }, [selection, layers, streetViewOn, trackData, ticks, editData]);

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
        // кнопки зума — под кнопкой слоёв (LayerSwitcher, top-3 right-3, высота 9); атрибуция и линейка масштаба слева
        // снизу — над нижними панелями (--bottom-inset, App), на узком окне — ещё и над строкой кнопок (MapActions). С !important: CSS MapLibre подключён вне @layer и без него
        // перебивает утилиту Tailwind своими top: 0 и bottom: 0
        <div
            className="absolute inset-0 isolate [&_.maplibregl-ctrl-bottom-left]:bottom-[calc(var(--bottom-inset)+3.25rem)]! sm:[&_.maplibregl-ctrl-bottom-left]:bottom-(--bottom-inset)! [&_.maplibregl-ctrl-top-right]:top-12!"
            data-testid="map"
        >
            <MapLibreMap
                ref={setMapRef}
                mapLib={maplibre}
                initialViewState={{ latitude: initialView.lat, longitude: initialView.lng, zoom: initialView.zoom }}
                mapStyle={mapStyle}
                transformRequest={transformRequest}
                // атрибуция — своим контролом слева снизу (MapButtons): справа снизу строка кнопок
                attributionControl={false}
                // поворота и наклона нет, как у старого клиента: компаса в макете 4a нет, а без него повёрнутую карту не
                // вернуть на север (design polish-web-ui)
                dragRotate={false}
                pitchWithRotate={false}
                touchPitch={false}
                onLoad={(event) => {
                    event.target.touchZoomRotate.disableRotation();
                    fitRequestedBounds();
                }}
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
                {children}
                <MapEditor />
                <ProfileOnMap />
                <PlacemarkOnMap />
                <StreetViewOnMap />
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
