import type { AppStore } from '@/state/store';
import type { LatLng } from '@/tracks/model';
import type { StreetViewApi } from './api';

// Режим Street View без React (design add-web-search-panoramas, «Street View: режим, клик, окно»): поиск панорамы по
// клику карты, устаревшие ответы, ошибка API. Окно и метку рисуют компоненты по стору.

export const UNAVAILABLE_MESSAGE = 'Street View is unavailable';

export interface StreetViewDeps {
    store: AppStore;
    api: StreetViewApi;
    notify: (title: string, type?: 'error') => void;
}

export type StreetView = ReturnType<typeof createStreetView>;

export function createStreetView({ store, api, notify }: StreetViewDeps) {
    // номер поиска: ответ после нового клика, выключения или закрытия отбрасывается
    let seq = 0;
    const state = () => store.getState();

    return {
        api,
        notify,
        toggle() {
            seq += 1;
            state().setStreetViewEnabled(!state().streetView.enabled);
        },
        close() {
            seq += 1;
            state().setPano(null);
        },
        // ближайшая панорама в радиусе; найдена — окно туда, взгляд — прежний (showPano старого: heading окна, pitch 0,
        // zoom 1)
        async searchAt(at: LatLng, radius: number) {
            if (!state().streetView.enabled) {
                return;
            }
            seq += 1;
            const current = seq;
            let found: LatLng | null;
            try {
                found = await api.findPanorama(at, radius);
            } catch {
                if (current === seq) {
                    notify(UNAVAILABLE_MESSAGE, 'error');
                }
                return;
            }
            if (current !== seq || !found || !state().streetView.enabled) {
                return;
            }
            state().requestPano({ ...found, heading: state().streetView.pano?.heading ?? 0, pitch: 0, zoom: 1 });
        },
    };
}
