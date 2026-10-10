import { AttributionControl, GeolocateControl, ScaleControl, useMap } from '@vis.gl/react-maplibre';
import { BinocularsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/state/context';
import { useStreetView } from '@/streetview/context';
import { ControlPortal } from './control-portal';
import { forgetPosition, savePosition } from './locate';

// Кнопки карты справа под быстрыми слоями (три зоны, design layout-three-zones и layer-thumbnails): Street View, зум
// капсулой, геолокация MapLibre; линейка масштаба и атрибуция — слева снизу. Свои контролы — ControlPortal
// (control-portal.tsx). Вид контролов — круглое стекло, правила в index.css.

// Зум: кнопки с разметкой и классами NavigationControl MapLibre (иконки — из его CSS, тесты ищут
// .maplibregl-ctrl-zoom-in), капсулой без номера зума (design layout-three-zones); зум нужен только, чтобы гасить кнопки
// на пределах. Компаса нет: поворот карты выключен (BaseMap)
function ZoomControl() {
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
            <button
                type="button"
                className="maplibregl-ctrl-zoom-in"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={map !== undefined && zoom >= map.getMaxZoom()}
                onClick={(event) => map?.zoomIn({}, { originalEvent: event.nativeEvent })}
            >
                <span className="maplibregl-ctrl-icon" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="maplibregl-ctrl-zoom-out"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={map !== undefined && zoom <= map.getMinZoom()}
                onClick={(event) => map?.zoomOut({}, { originalEvent: event.nativeEvent })}
            >
                <span className="maplibregl-ctrl-icon" aria-hidden="true" />
            </button>
        </ControlPortal>
    );
}

// Режим Street View (кнопка и Alt+P старого контрола панорам; code, а не key: на macOS Alt меняет символ)
function StreetViewControl() {
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
        <ControlPortal className="maplibregl-ctrl-group">
            <button
                type="button"
                // CSS MapLibre вне @layer задаёт кнопкам группы display: block и прозрачный фон: flex и фон нажатой — с !
                className={cn(
                    'flex! items-center justify-center [&_svg]:size-[18px]',
                    enabled && 'bg-primary! text-primary-foreground',
                )}
                aria-label="Street View"
                title="Street View (Alt+P)"
                aria-pressed={enabled}
                onClick={() => streetView.toggle()}
            >
                <BinocularsIcon />
            </button>
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

// Неактивная кнопка геолокации (запрещено раньше или нет API) клика не получает, а подсказка «Location not available»
// видна только при наведении — на телефоне её не увидеть (спека web-client, «Геолокация недоступна»). Пока кнопка
// disabled, она прозрачна для указателя, и нажатие ловит контейнер контрола: тост с причиной
function useDisabledGeolocateToast(notify: (title: string) => void) {
    const { current } = useMap();
    const map = current?.getMap();
    useEffect(() => {
        const button = map?.getContainer().querySelector<HTMLButtonElement>('.maplibregl-ctrl-geolocate');
        const group = button?.parentElement;
        if (!button || !group) {
            return;
        }
        // подсказку «Location not available» держит кнопка — пока она прозрачна для указателя, та же подсказка у группы
        const sync = () => {
            button.style.pointerEvents = button.disabled ? 'none' : '';
            group.title = button.disabled ? button.title : '';
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(button, { attributes: true, attributeFilter: ['disabled'] });
        const onClick = (event: MouseEvent) => {
            if (button.disabled && event.target === group) {
                notify('geolocation' in navigator ? geolocationErrorMessage(1, '') : geolocationErrorMessage(0, ''));
            }
        };
        group.addEventListener('click', onClick);
        return () => {
            observer.disconnect();
            group.removeEventListener('click', onClick);
        };
    }, [map, notify]);
}

export interface MapButtonsProps {
    notify: (title: string) => void;
    storage: Storage | null;
}

export function MapButtons({ notify, storage }: MapButtonsProps) {
    useDisabledGeolocateToast(notify);
    return (
        <>
            <StreetViewControl />
            <ZoomControl />
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
            {/* атрибуция и линейка масштаба слева снизу: снизу по центру — кнопка профиля (MapActions); MapLibre ставит
                каждый следующий нижний контрол выше — линейка над атрибуцией */}
            <AttributionControl position="bottom-left" />
            <ScaleControl position="bottom-left" unit="metric" />
        </>
    );
}
