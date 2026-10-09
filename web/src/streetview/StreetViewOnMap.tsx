import { Marker, useMap } from '@vis.gl/react-maplibre';
import { Navigation2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from '@/state/context';

// Метка панорамы на карте (PanoMarker старого клиента): позиция окна, повёрнутая по направлению взгляда. Окно перешло
// за край видимой части (5 % от края, bounds.pad(-0.05) старого) — карта сдвигается к нему.
export function StreetViewOnMap() {
    const { current } = useMap();
    const map = current?.getMap();
    const pano = useAppStore((state) => state.streetView.pano);
    const lat = pano?.lat;
    const lng = pano?.lng;

    useEffect(() => {
        if (!map || lat === undefined || lng === undefined) {
            return;
        }
        const bounds = map.getBounds();
        const padLat = (bounds.getNorth() - bounds.getSouth()) * 0.05;
        const padLng = (bounds.getEast() - bounds.getWest()) * 0.05;
        const inside =
            lat > bounds.getSouth() + padLat &&
            lat < bounds.getNorth() - padLat &&
            lng > bounds.getWest() + padLng &&
            lng < bounds.getEast() - padLng;
        if (!inside) {
            map.easeTo({ center: [lng, lat] });
        }
    }, [map, lat, lng]);

    if (!pano) {
        return null;
    }
    return (
        <Marker longitude={pano.lng} latitude={pano.lat} rotation={pano.heading} rotationAlignment="map">
            <div
                className="flex size-7 items-center justify-center rounded-full bg-amber-400 shadow ring-2 ring-white"
                data-testid="panorama-marker"
                data-heading={Math.round(pano.heading)}
                style={{ pointerEvents: 'none' }}
            >
                <Navigation2Icon className="size-4 fill-white text-white" />
            </div>
        </Marker>
    );
}
