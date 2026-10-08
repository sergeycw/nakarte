import type { MapRef } from '@vis.gl/react-maplibre';
import type { RequestTransformFunction } from 'maplibre-gl';
import { type Ref, useEffect, useState } from 'react';
import { Toaster, toast } from '@/components/ui/toast';
import { config } from '@/config';
import { buildCatalog } from '@/layers/catalog';
import { LayerSwitcher } from '@/layers/LayerSwitcher';
import { AppStoreContext } from '@/state/context';
import type { AppStore } from '@/state/store';
import { bindAppStore, startAppStore } from '@/state/sync';
import { InfoPanel } from './InfoPanel';
import { BaseMap } from './map/BaseMap';

function localStorageOrNull(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        // доступ к хранилищу запрещён (настройки сайта): приложение работает на умолчаниях
        return null;
    }
}

function startStore(): AppStore {
    const [lat, lng] = config.defaultLocation;
    return startAppStore({
        catalog: buildCatalog({
            pixelRatio: window.devicePixelRatio,
            language: navigator.language,
            corsProxyUrl: config.corsProxyUrl,
        }),
        corsProxyUrl: config.corsProxyUrl,
        defaultView: { lat, lng, zoom: config.defaultZoom },
        hash: window.location.hash,
        storage: localStorageOrNull(),
    });
}

interface AppProps {
    transformRequest?: RequestTransformFunction;
    mapRef?: Ref<MapRef>;
}

export function App({ transformRequest, mapRef }: AppProps) {
    const [store] = useState(startStore);
    useEffect(() => bindAppStore(store, window, localStorageOrNull()), [store]);

    function showTileError(code: string, status: number | undefined) {
        // 404 — «тайла нет» у региональных и разреженных слоёв (Slazav внутри района), это не ошибка
        if (status === 404) {
            return;
        }
        // постоянный id на слой: Base UI обновляет тост с тем же id на месте, серия ошибок даёт один тост
        toast.add({
            id: `tile-error:${code}`,
            title: 'Map tiles failed to load',
            description: store.getState().layers.get(code)?.title ?? code,
            type: 'error',
        });
    }

    return (
        <AppStoreContext value={store}>
            <Toaster>
                <main className="fixed inset-0 overflow-hidden">
                    <BaseMap onTileError={showTileError} transformRequest={transformRequest} ref={mapRef} />
                    <InfoPanel />
                    <LayerSwitcher />
                </main>
            </Toaster>
        </AppStoreContext>
    );
}
