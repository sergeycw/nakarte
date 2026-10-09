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
            const fail = () => {
                loading = null;
                script.remove();
                reject(new StreetViewUnavailable('Maps JavaScript API failed to load'));
            };
            w[CALLBACK] = () => {
                const maps = w.google?.maps;
                if (maps?.StreetViewPanorama) {
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

// для тестов загрузчика: забыть загруженный скрипт
export function resetGoogleMapsLoader() {
    loading = null;
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
            return new Promise((resolve) => {
                // форма с колбэком: она отдаёт статус явно, а что делает промис на ZERO_RESULTS, справка не говорит
                service.getPanorama(
                    { location: at, radius, preference: maps.StreetViewPreference.NEAREST },
                    (data, status) => {
                        const latLng = data?.location?.latLng;
                        resolve(
                            status === maps.StreetViewStatus.OK && latLng
                                ? { lat: latLng.lat(), lng: latLng.lng() }
                                : null,
                        );
                    },
                );
            });
        },

        async createViewer(container: HTMLElement, { onChange }: StreetViewHandlers): Promise<StreetViewViewer> {
            const maps = await load();
            // правила режима без ключа — только с пустым ключом (markKeylessContainer старого)
            container.classList.toggle('google-street-view-keyless', !key);
            const panorama = new maps.StreetViewPanorama(container, {
                enableCloseButton: false,
                imageDateControl: true,
                motionTracking: false,
                motionTrackingControl: false,
                fullscreenControl: false,
            });
            let destroyed = false;
            const report = () => {
                const view = currentView(panorama);
                if (view && !destroyed) {
                    onChange(view);
                }
            };
            for (const event of ['position_changed', 'pov_changed', 'zoom_changed']) {
                panorama.addListener(event, report);
            }
            return {
                show(view) {
                    panorama.setPosition({ lat: view.lat, lng: view.lng });
                    panorama.setPov({ heading: view.heading, pitch: view.pitch });
                    panorama.setZoom(view.zoom);
                    panorama.setVisible(true);
                },
                resize: () => maps.event.trigger(panorama, 'resize'),
                destroy() {
                    destroyed = true;
                    maps.event.clearInstanceListeners(panorama);
                    panorama.setVisible(false);
                },
            };
        },
    };
}
