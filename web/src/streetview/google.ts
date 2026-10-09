import type { LatLng } from '@/tracks/model';
import type { StreetViewApi, StreetViewHandlers, StreetViewViewer } from './api';
import type { PanoView } from './hash';
import './keyless.css';

// Street View на Maps JavaScript API (design add-web-search-panoramas, «Maps JavaScript API и ключ»): провайдер google
// старого клиента (src/lib/leaflet.control.panoramas/lib/google/index.js). API грузится скриптом один раз на страницу и
// только по требованию; адрес — как у старого (v=3&key=), плюс документированный callback. Пустой ключ — режим без ключа,
// правила keyless.css включаются классом контейнера окна.

// Своя часть типов API вместо @types/google.maps: нужны пять методов (справка Street View, 2026-10-09). У StreetViewPov
// нет zoom — зум окна через getZoom/setZoom (старый клиент читал pov.zoom).
interface GLatLng {
    lat(): number;
    lng(): number;
}

interface GPanorama {
    getPosition(): GLatLng | null;
    setPosition(position: { lat: number; lng: number }): void;
    getPov(): { heading: number; pitch: number };
    setPov(pov: { heading: number; pitch: number }): void;
    getZoom(): number;
    setZoom(zoom: number): void;
    setVisible(visible: boolean): void;
    addListener(event: string, handler: () => void): unknown;
}

interface GMaps {
    StreetViewPanorama: new (container: HTMLElement, options: Record<string, unknown>) => GPanorama;
    StreetViewService: new () => {
        getPanorama(
            request: { location: LatLng; radius: number; preference: unknown },
            callback: (data: { location?: { latLng?: GLatLng } } | null, status: unknown) => void,
        ): unknown;
    };
    StreetViewPreference: { NEAREST: unknown };
    StreetViewStatus: { OK: unknown };
    event: { trigger(target: unknown, event: string): void; clearInstanceListeners(target: unknown): void };
}

// глобальные имена API: window.google и колбэк загрузки
type GoogleWindow = Window & { google?: { maps?: GMaps } } & Record<string, unknown>;

export const GOOGLE_MAPS_API = 'https://maps.googleapis.com/maps/api/js';
const CALLBACK = '__nakarteGoogleMapsReady';

export function googleMapsUrl(key: string): string {
    return `${GOOGLE_MAPS_API}?v=3&key=${encodeURIComponent(key)}&callback=${CALLBACK}`;
}

export class StreetViewUnavailable extends Error {}

let loading: Promise<GMaps> | null = null;
// скрипт, который не загрузился и не упал за это время, считается упавшим: иначе тоста не будет никогда
const LOAD_TIMEOUT_MS = 20_000;
// поиск панорамы без ответа — ошибка API, а не «панорамы нет»
const SEARCH_TIMEOUT_MS = 10_000;

// Скрипт API один на страницу. Ошибка загрузки сбрасывает промис: следующий клик пробует снова.
export function loadGoogleMaps(key: string, doc?: Document, win?: GoogleWindow): Promise<GMaps> {
    const w = win ?? (window as unknown as GoogleWindow);
    if (w.google?.maps?.StreetViewPanorama) {
        return Promise.resolve(w.google.maps);
    }
    const d = doc ?? document;
    if (!loading) {
        loading = new Promise<GMaps>((resolve, reject) => {
            const script = d.createElement('script');
            const timer = setTimeout(() => fail(), LOAD_TIMEOUT_MS);
            const fail = () => {
                clearTimeout(timer);
                loading = null;
                script.remove();
                reject(new StreetViewUnavailable('Maps JavaScript API failed to load'));
            };
            w[CALLBACK] = () => {
                const maps = w.google?.maps;
                if (maps?.StreetViewPanorama) {
                    clearTimeout(timer);
                    resolve(maps);
                } else {
                    fail();
                }
            };
            script.src = googleMapsUrl(key);
            script.async = true;
            script.onerror = fail;
            d.head.append(script);
        });
    }
    return loading;
}

// Окно Google одно на страницу (как у старого клиента): уничтожить StreetViewPanorama API не даёт, а новое окно на
// каждое включение режима копило бы WebGL-сцены (лимит контекстов браузера общий с картой). Окно живёт в своём div,
// который переходит в контейнер очередной панели; owner — чья панель сейчас владеет окном.
interface SharedViewer {
    element: HTMLElement;
    panorama: GPanorama;
    owner: object | null;
    report: (() => void) | null;
}

let shared: SharedViewer | null = null;

// для тестов загрузчика: забыть загруженный скрипт и окно
export function resetGoogleMapsLoader() {
    loading = null;
    shared = null;
}

function currentView(panorama: GPanorama): PanoView | null {
    const position = panorama.getPosition();
    if (!position) {
        return null;
    }
    const { heading, pitch } = panorama.getPov();
    return {
        lat: position.lat(),
        lng: position.lng(),
        heading: heading || 0,
        pitch: pitch || 0,
        zoom: panorama.getZoom() || 1,
    };
}

export function googleStreetView(key: string): StreetViewApi {
    const load = () => loadGoogleMaps(key);
    return {
        async findPanorama(at, radius) {
            const maps = await load();
            const service = new maps.StreetViewService();
            return new Promise((resolve, reject) => {
                const timer = setTimeout(
                    () => reject(new StreetViewUnavailable('Street View search timed out')),
                    SEARCH_TIMEOUT_MS,
                );
                // форма с колбэком: она отдаёт статус явно, а что делает промис на ZERO_RESULTS, справка не говорит;
                // его отказ гасится, чтобы не было «Uncaught (in promise)»
                const returned = service.getPanorama(
                    { location: at, radius, preference: maps.StreetViewPreference.NEAREST },
                    (data, status) => {
                        clearTimeout(timer);
                        const latLng = data?.location?.latLng;
                        resolve(
                            status === maps.StreetViewStatus.OK && latLng
                                ? { lat: latLng.lat(), lng: latLng.lng() }
                                : null,
                        );
                    },
                );
                (returned as Promise<unknown> | undefined)?.catch?.(() => {});
            });
        },

        async createViewer(container: HTMLElement, { onChange }: StreetViewHandlers): Promise<StreetViewViewer> {
            const maps = await load();
            if (!shared) {
                const element = document.createElement('div');
                element.style.position = 'absolute';
                element.style.inset = '0';
                const panorama = new maps.StreetViewPanorama(element, {
                    enableCloseButton: false,
                    imageDateControl: true,
                    motionTracking: false,
                    motionTrackingControl: false,
                    fullscreenControl: false,
                });
                const viewer: SharedViewer = { element, panorama, owner: null, report: null };
                for (const event of ['position_changed', 'pov_changed', 'zoom_changed']) {
                    panorama.addListener(event, () => viewer.report?.());
                }
                shared = viewer;
            }
            const viewer = shared;
            const owner = {};
            viewer.owner = owner;
            // правила режима без ключа — только с пустым ключом (markKeylessContainer старого); класс — на прямом
            // родителе .gm-style, как у старого
            viewer.element.classList.toggle('google-street-view-keyless', !key);
            container.append(viewer.element);
            viewer.report = () => {
                const view = currentView(viewer.panorama);
                if (view) {
                    onChange(view);
                }
            };
            const mine = () => viewer.owner === owner;
            return {
                show(view) {
                    if (!mine()) {
                        return;
                    }
                    viewer.panorama.setPosition({ lat: view.lat, lng: view.lng });
                    viewer.panorama.setPov({ heading: view.heading, pitch: view.pitch });
                    viewer.panorama.setZoom(view.zoom);
                    viewer.panorama.setVisible(true);
                },
                resize: () => {
                    if (mine()) {
                        maps.event.trigger(viewer.panorama, 'resize');
                    }
                },
                // окно остаётся для следующей панели: спрятано, без слушателя, вне документа
                destroy() {
                    if (!mine()) {
                        return;
                    }
                    viewer.owner = null;
                    viewer.report = null;
                    viewer.panorama.setVisible(false);
                    viewer.element.remove();
                },
            };
        },
    };
}
