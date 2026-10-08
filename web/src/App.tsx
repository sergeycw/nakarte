import type { MapRef } from '@vis.gl/react-maplibre';
import type { Ref } from 'react';
import { Toaster, toast } from '@/components/ui/toast';
import { InfoPanel } from './InfoPanel';
import { BaseMap } from './map/BaseMap';

// Постоянный id: Base UI обновляет тост с тем же id на месте, а не добавляет новый,
// поэтому серия ошибок тайлов даёт один тост.
const TILE_ERROR_TOAST_ID = 'tile-error';

function showTileError() {
    toast.add({ id: TILE_ERROR_TOAST_ID, title: 'Map tiles failed to load', type: 'error' });
}

interface AppProps {
    tileUrl?: string;
    mapRef?: Ref<MapRef>;
}

export function App({ tileUrl, mapRef }: AppProps) {
    return (
        <Toaster>
            <main className="fixed inset-0 overflow-hidden">
                <BaseMap tileUrl={tileUrl} onTileError={showTileError} ref={mapRef} />
                <InfoPanel />
            </main>
        </Toaster>
    );
}
