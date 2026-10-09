import type { MapRef } from '@vis.gl/react-maplibre';
import type { RequestTransformFunction } from 'maplibre-gl';
import { type Ref, useEffect, useState } from 'react';
import { type AutosaveStorage, startAutosave } from '@/autosave/autosave';
import { indexedDbStorage } from '@/autosave/idb';
import { Toaster, toast } from '@/components/ui/toast';
import { config } from '@/config';
import { ElevationProfileContext } from '@/elevation/context';
import { createElevationProfile } from '@/elevation/controller';
import { ElevationProfile, PROFILE_HEIGHT } from '@/elevation/ElevationProfile';
import { getEngine } from '@/engine/engine';
import { buildCatalog } from '@/layers/catalog';
import { LayerSwitcher } from '@/layers/LayerSwitcher';
import { EditPanel } from '@/routing/EditPanel';
import { createRouteEditing } from '@/routing/editing';
import { RouteEditingContext } from '@/routing/editing-context';
import { MapMenu } from '@/routing/MapMenu';
import { createRouter, type Router } from '@/routing/router';
import { SearchBox } from '@/search/SearchBox';
import { AppStoreContext, useAppStore } from '@/state/context';
import { parseHash, parseView } from '@/state/hash';
import type { AppStore } from '@/state/store';
import { bindAppStore, startAppStore } from '@/state/sync';
import { createTrackActions, type TrackActionsDeps } from '@/tracks/actions';
import { TrackActionsContext } from '@/tracks/actions-context';
import { isTrackParam } from '@/tracks/links';
import { PointPanel } from '@/tracks/PointPanel';
import { PointNameDialog } from '@/tracks/TrackDialogs';
import { TrackList } from '@/tracks/TrackList';
import { InfoPanel } from './InfoPanel';
import { BaseMap } from './map/BaseMap';
import { loadPosition, refreshPosition } from './map/locate';
import { MapButtons } from './map/MapButtons';

function localStorageOrNull(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        // доступ к хранилищу запрещён (настройки сайта): приложение работает на умолчаниях
        return null;
    }
}

// Заход без вида и без треков в адресе — на последнем положении пользователя (moveMapToCurrentLocation старого клиента)
function startsAtPosition(hash: string): boolean {
    const params = parseHash(hash);
    return !parseView(params.get('m')) && ![...params.keys()].some(isTrackParam);
}

function startStore(): AppStore {
    const [lat, lng] = config.defaultLocation;
    const position = startsAtPosition(window.location.hash) ? loadPosition(localStorageOrNull()) : null;
    return startAppStore({
        catalog: buildCatalog({
            pixelRatio: window.devicePixelRatio,
            language: navigator.language,
            corsProxyUrl: config.corsProxyUrl,
        }),
        corsProxyUrl: config.corsProxyUrl,
        defaultView: { ...(position ?? { lat, lng }), zoom: config.defaultZoom },
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
    // хранилище автосохранения треков: по умолчанию IndexedDB nakarte-web, null — без сохранения; browser-тесты
    // подставляют своё, чтобы рендеры App в одной странице не видели чужих треков
    autosave?: AutosaveStorage | null;
}

// Высота нижней панели (профиль высот) — CSS-переменная на <html>: над панелью встают панели редактора, атрибуция
// карты и тосты, а тосты Base UI рендерятся в портал вне <main>
function BottomInset() {
    const open = useAppStore((state) => state.profile !== null);
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--bottom-inset', open ? `calc(${PROFILE_HEIGHT} + 0.75rem)` : '0px');
        return () => {
            root.style.removeProperty('--bottom-inset');
        };
    }, [open]);
    return null;
}

function notify(title: string, type?: 'error' | 'success') {
    toast.add({ title, type });
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

export function App({
    transformRequest,
    mapRef,
    fetch = window.fetch.bind(window),
    writeClipboard,
    router,
    autosave,
}: AppProps) {
    const [store] = useState(startStore);
    const [atPosition] = useState(() => startsAtPosition(window.location.hash));
    useEffect(() => {
        if (atPosition) {
            refreshPosition(navigator.geolocation, localStorageOrNull(), (position) =>
                store.getState().requestView({ ...position, zoom: config.defaultZoom }),
            );
        }
    }, [atPosition, store]);
    const [autosaveStorage] = useState(() => (autosave === undefined ? indexedDbStorage() : autosave));
    const [restored] = useState(deferred);
    const [trackActions] = useState(() =>
        createTrackActions({
            store,
            sources: {
                fetch,
                corsProxyUrl: config.corsProxyUrl,
                tracksStorageServer: config.tracksStorageServer,
                elevationsServer: config.elevationsServer,
            },
            notify,
            location: () => window.location,
            writeClipboard,
            restored: restored.promise,
        }),
    );
    // Автосохранение — в эффекте, а не в инициализаторе: Strict Mode вызывает эффект дважды, и первый экземпляр
    // останавливается до конца чтения, не добавив треков. restored отпускает треки из адреса только после чтения
    // живого экземпляра (design add-web-autosave, «Восстановление и треки из адреса»).
    useEffect(() => {
        if (!autosaveStorage) {
            restored.resolve();
            return;
        }
        let active = true;
        const saving = startAutosave(store, autosaveStorage);
        saving.restored.finally(() => {
            if (active) {
                restored.resolve();
            }
        });
        const flush = () => saving.flush();
        const onHidden = () => {
            if (document.visibilityState === 'hidden') {
                saving.flush();
            }
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onHidden);
        return () => {
            active = false;
            // размонтирование — как уход со страницы: несохранённое пишется (browser-тесты так «перезагружают» App)
            saving.flush();
            saving.stop();
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', onHidden);
        };
    }, [store, autosaveStorage, restored]);
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
    const [elevationProfile] = useState(() =>
        createElevationProfile({ store, source: { fetch, url: config.elevationsServer }, notify }),
    );
    useEffect(() => elevationProfile.start(), [elevationProfile]);
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
                    <ElevationProfileContext value={elevationProfile}>
                        <BottomInset />
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
                                <BaseMap onTileError={showTileError} transformRequest={transformRequest} ref={mapRef}>
                                    <MapButtons notify={notify} storage={localStorageOrNull()} fetch={fetch} />
                                </BaseMap>
                                {/* левая колонка: панель с названием и список треков; справа место под кнопку слоёв (4.5rem = поля + кнопка), снизу — над профилем высот (--bottom-inset), клики между панелями уходят карте */}
                                <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-h-[calc(100dvh-1.5rem-var(--bottom-inset))] w-80 max-w-[calc(100vw-4.5rem)] flex-col items-start gap-2">
                                    <InfoPanel>
                                        <SearchBox sources={{ fetch, corsProxyUrl: config.corsProxyUrl }} />
                                    </InfoPanel>
                                    <TrackList />
                                </div>
                                <LayerSwitcher />
                                <EditPanel />
                                <PointPanel />
                                <ElevationProfile />
                                <MapMenu />
                                <PointNameDialog />
                            </main>
                        </Toaster>
                    </ElevationProfileContext>
                </RouteEditingContext>
            </TrackActionsContext>
        </AppStoreContext>
    );
}
