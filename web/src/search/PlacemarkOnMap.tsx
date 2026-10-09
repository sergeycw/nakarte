import { Marker } from '@vis.gl/react-maplibre';
import { MapPinIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useRouteEditing } from '@/routing/editing-context';
import { useAppStore, useAppStoreApi } from '@/state/context';
import { useTrackActions } from '@/tracks/actions-context';

// Метка найденного места на карте (design add-web-search-panoramas, «Метка»): булавка и название. Клик по карте мимо
// метки её снимает (MapEditor.onClick). Клик по метке до карты не доходит: родные события элемента гасятся здесь —
// обработчик React опоздал бы, React слушает корень приложения, а карта — свой контейнер внутри него. Клик при постановке
// точки трека ставит точку с названием метки (suggestedPoint старого клиента), при рисовании — опорную точку.
export function PlacemarkOnMap() {
    const placemark = useAppStore((state) => state.placemark);
    const store = useAppStoreApi();
    const actions = useTrackActions();
    const editing = useRouteEditing();
    // родные слушатели на элемент метки: ref-колбэк с очисткой (React 19), элемент появляется вместе с меткой
    const attach = useCallback(
        (node: HTMLDivElement | null) => {
            if (!node) {
                return;
            }
            const stop = (event: Event) => event.stopPropagation();
            const onClick = (event: Event) => {
                event.stopPropagation();
                const state = store.getState();
                const mark = state.placemark;
                if (!mark) {
                    return;
                }
                const latlng = { lat: mark.lat, lng: mark.lng };
                if (state.pointTool?.kind === 'add') {
                    actions.addPoint(state.pointTool.trackId, latlng, mark.title);
                } else if (state.routeEdit?.drawing) {
                    editing.click(latlng);
                } else {
                    return;
                }
                state.setPlacemark(null);
            };
            const events = ['mousedown', 'mouseup', 'dblclick', 'touchstart', 'touchend', 'contextmenu'];
            for (const type of events) {
                node.addEventListener(type, stop);
            }
            node.addEventListener('click', onClick);
            return () => {
                for (const type of events) {
                    node.removeEventListener(type, stop);
                }
                node.removeEventListener('click', onClick);
            };
        },
        [store, actions, editing],
    );

    if (!placemark) {
        return null;
    }
    return (
        <Marker longitude={placemark.lng} latitude={placemark.lat} anchor="bottom">
            <div
                ref={attach}
                className="flex cursor-pointer flex-col items-center"
                data-testid="placemark"
                title={placemark.title}
            >
                {placemark.title && (
                    <span className="mb-0.5 max-w-48 truncate rounded bg-white/90 px-1.5 py-0.5 font-medium text-xs shadow">
                        {placemark.title}
                    </span>
                )}
                <MapPinIcon className="size-7 fill-red-500 text-white drop-shadow" strokeWidth={1.5} />
            </div>
        </Marker>
    );
}
