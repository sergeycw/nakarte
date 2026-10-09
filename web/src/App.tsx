import type { MapRef } from '@vis.gl/react-maplibre';
import type { RequestTransformFunction } from 'maplibre-gl';
import { type Ref, useEffect, useState } from 'react';
import { Toaster, toast } from '@/components/ui/toast';
import { config } from '@/config';
import { getEngine } from '@/engine/engine';
import { buildCatalog } from '@/layers/catalog';
import { LayerSwitcher } from '@/layers/LayerSwitcher';
import { EditPanel } from '@/routing/EditPanel';
import { createRouteEditing } from '@/routing/editing';
import { RouteEditingContext } from '@/routing/editing-context';
import { createRouter, type Router } from '@/routing/router';
import { AppStoreContext } from '@/state/context';
import type { AppStore } from '@/state/store';
import { bindAppStore, startAppStore } from '@/state/sync';
import { createTrackActions, type TrackActionsDeps } from '@/tracks/actions';
import { TrackActionsContext } from '@/tracks/actions-context';
import { TrackList } from '@/tracks/TrackList';
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
    // сеть треков (хранилище, прокси) и буфер обмена: browser-тесты подставляют свои, в сеть они не ходят
    fetch?: typeof fetch;
    writeClipboard?: TrackActionsDeps['writeClipboard'];
    // роутер прокладки: browser-тесты подставляют поддельный, по умолчанию — движок или сервер из config
    router?: Router;
}

function notify(title: string, type?: 'error' | 'success') {
    toast.add({ title, type });
}

export function App({ transformRequest, mapRef, fetch = window.fetch.bind(window), writeClipboard, router }: AppProps) {
    const [store] = useState(startStore);
    const [trackActions] = useState(() =>
        createTrackActions({
            store,
            sources: { fetch, corsProxyUrl: config.corsProxyUrl, tracksStorageServer: config.tracksStorageServer },
            notify,
            location: () => window.location,
            writeClipboard,
        }),
    );
    const [routeEditing] = useState(() =>
        createRouteEditing({
            store,
            router:
                router ??
                createRouter({
                    engine: config.routingEngine,
                    routingServer: config.routingServer,
                    fetch,
                    getEngine,
                }),
            engine: config.routingEngine,
            notify,
            storage: localStorageOrNull(),
        }),
    );
    useEffect(
        () => bindAppStore(store, window, localStorageOrNull(), trackActions.openTrackParams),
        [store, trackActions],
    );
    // активность уже выбрана — движок прогревается при загрузке страницы (спека browser-routing-engine); движок —
    // синглтон, повторный вызов в Strict Mode его не создаёт второй раз
    useEffect(() => routeEditing.warmUp(), [routeEditing]);

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
            <TrackActionsContext value={trackActions}>
                <RouteEditingContext value={routeEditing}>
                    <Toaster>
                        <main
                            className="fixed inset-0 overflow-hidden"
                            // файлы треков можно бросить на карту (onFileDragDrop старого клиента)
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                                event.preventDefault();
                                if (event.dataTransfer.files.length) {
                                    trackActions.openFiles([...event.dataTransfer.files]);
                                }
                            }}
                        >
                            <BaseMap onTileError={showTileError} transformRequest={transformRequest} ref={mapRef} />
                            {/* левая колонка: панель с названием и список треков; справа место под кнопку слоёв (4.5rem = поля + кнопка), клики между панелями уходят карте */}
                            <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-h-[calc(100dvh-1.5rem)] w-80 max-w-[calc(100vw-4.5rem)] flex-col items-start gap-2">
                                <InfoPanel />
                                <TrackList />
                            </div>
                            <LayerSwitcher />
                            <EditPanel />
                        </main>
                    </Toaster>
                </RouteEditingContext>
            </TrackActionsContext>
        </AppStoreContext>
    );
}
