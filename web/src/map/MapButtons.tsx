import { GeolocateControl, ScaleControl, useControl, useMap } from '@vis.gl/react-maplibre';
import { BinocularsIcon, ExternalLinkIcon, RulerIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { config } from '@/config';
import { useRouteEditing } from '@/routing/editing-context';
import { useAppStore, useAppStoreApi } from '@/state/context';
import { useStreetView } from '@/streetview/context';
import { EXTERNAL_MAPS, type ExternalMap, externalMapUrl } from './external';
import { forgetPosition, savePosition } from './locate';

// Кнопки карты справа под кнопками зума (design add-web-search-panoramas, «Кнопки карты справа»): номер зума,
// геолокация MapLibre, своя группа кнопок; линейка масштаба — слева снизу. Свои контролы — контейнер контрола MapLibre с
// порталом React: так они встают в тот же столбец, что кнопки MapLibre, в порядке монтирования.

// Контейнер контрола MapLibre для портала React
function useControlContainer(className: string): HTMLElement {
    const [container] = useState(() => {
        const element = document.createElement('div');
        element.className = `maplibregl-ctrl ${className}`;
        return element;
    });
    useControl(
        () => ({
            onAdd: () => container,
            onRemove: () => container.remove(),
        }),
        { position: 'top-right' },
    );
    return container;
}

function ControlPortal({ className, children }: { className: string; children: ReactNode }) {
    return createPortal(children, useControlContainer(className));
}

// Номер зума в единицах старого клиента (leaflet.control.zoom-display): MapLibre + 1
function ZoomDisplay() {
    const { current } = useMap();
    const map = current?.getMap();
    const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0);
    useEffect(() => {
        if (!map) {
            return;
        }
        const update = () => setZoom(map.getZoom());
        update();
        map.on('zoom', update);
        return () => {
            map.off('zoom', update);
        };
    }, [map]);
    return (
        <ControlPortal className="maplibregl-ctrl-group">
            <div
                className="flex h-[22px] w-[29px] items-center justify-center font-medium text-xs tabular-nums"
                title="Zoom level"
                data-testid="zoom-level"
            >
                {Math.round(zoom + 1)}
            </div>
        </ControlPortal>
    );
}

// Тексты ошибок — locationErrorMessage старого клиента (src/App.js)
export function geolocationErrorMessage(code: number, message: string): string {
    switch (code) {
        case 0:
            return 'Your browser does not support geolocation.';
        case 1:
            return 'Geolocation is blocked for this site. Please, enable in browser setting.';
        case 2:
            return 'Failed to acquire position for unknown reason.';
        default:
            return `Geolocation error: ${message}`;
    }
}

export interface MapButtonsProps {
    notify: (title: string) => void;
    storage: Storage | null;
    fetch: typeof window.fetch;
}

// Режим Street View (кнопка и Alt+P старого контрола панорам; code, а не key: на macOS Alt меняет символ)
function StreetViewButton() {
    const streetView = useStreetView();
    const enabled = useAppStore((state) => state.streetView.enabled);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey && event.code === 'KeyP') {
                event.preventDefault();
                streetView.toggle();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [streetView]);
    return (
        <button
            type="button"
            className={`flex! items-center justify-center ${enabled ? 'bg-amber-300! hover:bg-amber-400!' : ''}`}
            aria-label="Street View"
            aria-pressed={enabled}
            title="Street View (Alt+P)"
            onClick={() => streetView.toggle()}
        >
            <BinocularsIcon className="size-4" />
        </button>
    );
}

// «Measure distance»: трек Ruler с отметками расстояния и сразу рисование (control-ruler.js старого)
function RulerButton() {
    const editing = useRouteEditing();
    return (
        <button
            type="button"
            className="flex! items-center justify-center"
            aria-label="Measure distance"
            title="Measure distance"
            onClick={() => editing.newTrack('Ruler', { measureTicksShown: true })}
        >
            <RulerIcon className="size-4" />
        </button>
    );
}

function ExternalMapsButton({ fetch }: { fetch: typeof window.fetch }) {
    const store = useAppStoreApi();
    async function open(map: ExternalMap) {
        const url = await externalMapUrl(
            map,
            store.getState().view,
            { fetch, url: config.elevationsServer },
            window.innerHeight,
        );
        window.open(url, '_blank', 'noopener');
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        className="flex! items-center justify-center"
                        aria-label="Open this place in another map"
                        title="Open this place in another map"
                    />
                }
            >
                <ExternalLinkIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Open this place in</DropdownMenuLabel>
                    {EXTERNAL_MAPS.map((map) => (
                        <DropdownMenuItem key={map.title} onClick={() => void open(map)}>
                            {map.title}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function MapButtons({ notify, storage, fetch, children }: MapButtonsProps & { children?: ReactNode }) {
    return (
        <>
            <ZoomDisplay />
            <GeolocateControl
                position="top-right"
                trackUserLocation
                // у MapLibre таймаут 6 с — на телефоне первый фикс GPS дольше; у старого таймаута не было
                positionOptions={{ enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 }}
                // maxAutoZoom 17 старого клиента — в зуме MapLibre
                fitBoundsOptions={{ maxZoom: 16 }}
                onGeolocate={(event) =>
                    savePosition(storage, { lat: event.coords.latitude, lng: event.coords.longitude })
                }
                onError={(event) => {
                    if (event.code === 1) {
                        forgetPosition(storage);
                    }
                    notify(geolocationErrorMessage(event.code, event.message));
                }}
            />
            <ControlPortal className="maplibregl-ctrl-group">
                {children}
                <StreetViewButton />
                <RulerButton />
                <ExternalMapsButton fetch={fetch} />
            </ControlPortal>
            <ScaleControl position="bottom-left" unit="metric" />
        </>
    );
}
