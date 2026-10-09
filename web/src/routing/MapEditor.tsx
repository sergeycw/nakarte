import { useMap } from '@vis.gl/react-maplibre';
import type { Map as MaplibreMap, MapMouseEvent, MapTouchEvent, PointLike } from 'maplibre-gl';
import { useEffect } from 'react';
import { useAppStoreApi } from '@/state/context';
import type { AppStore } from '@/state/store';
import type { LatLng } from '@/tracks/model';
import { TRACK_LINES, TRACK_UNROUTED } from '@/tracks/style';
import { EDIT_HIT, EDIT_WAYPOINTS } from './edit-style';
import type { RouteEditing } from './editing';
import { useRouteEditing } from './editing-context';

// События карты для редактора (design add-web-route-editor, «События карты»). Компонент внутри <Map>: обработчики
// MapLibre и document вешаются один раз, текущее состояние читается из стора в момент события.
//
// - клик: опорная точка (крайняя начинает рисование от своего конца, последняя поставленная заканчивает его), при
//   рисовании — новая точка (Alt — прямой отрезок), без рисования — по линии трека начать редактирование, мимо линии
//   закончить;
// - нажатие на опорную точку — перетаскивание, на линию (не при рисовании) — вставка точки и её перетаскивание;
//   preventDefault у mousedown/touchstart MapLibre выключает панораму карты на этот жест (ui/handler/map_event.ts);
// - двойной клик по опорной точке — удаление, preventDefault гасит зум;
// - клавиши на keydown: на macOS, пока зажат Cmd, keyup других клавиш не приходит (AGENTS.md, «Где код роутинга»).

// допуск попадания по точке и линии, px: кружок опорной точки — радиус 6 + обводка 2
const HIT_RADIUS = 9;

export type EditorKey = 'undo' | 'redo' | 'backspace' | 'escape';

// Хоткеи редактора по event.code — от раскладки не зависят. В полях ввода редактор клавиши не трогает.
export function editorKey(event: KeyboardEvent): EditorKey | null {
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return null;
    }
    const command = event.ctrlKey || event.metaKey;
    if (command && event.code === 'KeyZ') {
        return event.shiftKey ? 'redo' : 'undo';
    }
    if (event.ctrlKey && event.code === 'KeyY') {
        return 'redo';
    }
    if (command || event.altKey) {
        return null;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
        return 'backspace';
    }
    if (event.key === 'Escape' || event.key === 'Enter') {
        return 'escape';
    }
    return null;
}

function box(point: { x: number; y: number }, radius = HIT_RADIUS): [PointLike, PointLike] {
    return [
        [point.x - radius, point.y - radius],
        [point.x + radius, point.y + radius],
    ];
}

function hitWaypoint(map: MaplibreMap, point: { x: number; y: number }): number | null {
    const features = map.queryRenderedFeatures(box(point), { layers: [EDIT_WAYPOINTS] });
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const feature of features) {
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        const projected = map.project([lng, lat]);
        const d = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
        if (d < bestDistance) {
            bestDistance = d;
            best = feature.properties.index as number;
        }
    }
    return best;
}

function hitEditLeg(map: MaplibreMap, point: { x: number; y: number }): number | null {
    const [feature] = map.queryRenderedFeatures(box(point, 2), { layers: [EDIT_HIT] });
    return feature ? (feature.properties.leg as number) : null;
}

function hitTrack(map: MaplibreMap, point: { x: number; y: number }): { trackId: string; segment: number } | null {
    const [feature] = map.queryRenderedFeatures(box(point, 5), { layers: [TRACK_LINES, TRACK_UNROUTED] });
    return feature ? { trackId: feature.properties.id as string, segment: feature.properties.segment as number } : null;
}

// Точка в той копии мира, что ближе к опорной (wrapLatLngToTarget старого клиента): MapLibre рисует копии мира, и
// клик по соседней копии иначе дал бы скачок линии через весь мир
function nearTo(latlng: LatLng, reference: LatLng | undefined): LatLng {
    if (!reference) {
        return latlng;
    }
    return { lat: latlng.lat, lng: latlng.lng + 360 * Math.round((reference.lng - latlng.lng) / 360) };
}

function lngLat(event: MapMouseEvent | MapTouchEvent): LatLng {
    return { lat: event.lngLat.lat, lng: event.lngLat.lng };
}

function updateCursor(map: MaplibreMap, store: AppStore, editing: RouteEditing, overWaypoint: boolean) {
    const edit = store.getState().routeEdit;
    let cursor = '';
    if (overWaypoint) {
        cursor = 'move';
    } else if (edit?.drawing) {
        cursor = 'crosshair';
    }
    // пока идут запросы, курсор показывает ожидание (спека route-editing, «Клик при рисовании»)
    if (!overWaypoint && editing.pending() > 0) {
        cursor = 'progress';
    }
    map.getCanvas().style.cursor = cursor;
}

function bind(map: MaplibreMap, store: AppStore, editing: RouteEditing): () => void {
    const state = () => store.getState();
    // клик после перетаскивания или вставки уже обработан жестом
    let suppressClick = false;
    let dragging = false;

    function rubberBand(cursor: LatLng | null) {
        const edit = state().routeEdit;
        if (!edit?.drawing || !cursor || dragging) {
            if (!dragging && state().routePreview) {
                state().setRoutePreview(null);
            }
            return;
        }
        const { waypoints } = edit.line;
        const anchor = edit.drawing === 'end' ? waypoints.at(-1) : waypoints[0];
        state().setRoutePreview(anchor ? { lines: [[anchor, nearTo(cursor, anchor)]] } : null);
    }

    function startDrag(index: number, inserted: boolean, clientStart: { x: number; y: number }, touch: boolean) {
        const edit = state().routeEdit;
        if (!edit) {
            return;
        }
        dragging = true;
        const { waypoints } = edit.line;
        const origin = waypoints[index];
        let latlng = origin;
        let moved = false;
        const canvas = map.getCanvasContainer();

        function move(clientX: number, clientY: number) {
            if (!moved && Math.hypot(clientX - clientStart.x, clientY - clientStart.y) < 3) {
                return;
            }
            moved = true;
            const rect = canvas.getBoundingClientRect();
            const point = map.unproject([clientX - rect.left, clientY - rect.top]);
            latlng = nearTo({ lat: point.lat, lng: point.lng }, origin);
            const neighbours = [waypoints[index - 1], waypoints[index + 1]].filter((p): p is LatLng => Boolean(p));
            state().setRoutePreview({ lines: neighbours.map((p) => [p, latlng]), drag: { index, latlng } });
        }

        const onMouseMove = (event: MouseEvent) => move(event.clientX, event.clientY);
        const onTouchMove = (event: TouchEvent) => {
            const t = event.touches[0];
            if (t) {
                event.preventDefault();
                move(t.clientX, t.clientY);
            }
        };
        const finish = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', finish);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', finish);
            window.removeEventListener('touchcancel', finish);
            dragging = false;
            state().setRoutePreview(null);
            if (moved) {
                editing.moveWaypoint(index, latlng);
            }
            if (moved || inserted) {
                suppressClick = true;
                setTimeout(() => {
                    suppressClick = false;
                }, 0);
            }
        };
        if (touch) {
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', finish);
            window.addEventListener('touchcancel', finish);
        } else {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', finish);
        }
    }

    function onDown(event: MapMouseEvent | MapTouchEvent, client: { x: number; y: number }, touch: boolean) {
        const edit = state().routeEdit;
        if (!edit) {
            return;
        }
        const index = hitWaypoint(map, event.point);
        if (index !== null) {
            event.preventDefault();
            startDrag(index, false, client, touch);
            return;
        }
        if (edit.drawing) {
            return;
        }
        const leg = hitEditLeg(map, event.point);
        if (leg !== null) {
            event.preventDefault();
            const inserted = editing.insertWaypoint(leg, nearTo(lngLat(event), edit.line.waypoints[leg]));
            if (inserted >= 0) {
                startDrag(inserted, true, client, touch);
            }
        }
    }

    const onMouseDown = (event: MapMouseEvent) => {
        if (event.originalEvent.button === 0) {
            onDown(event, { x: event.originalEvent.clientX, y: event.originalEvent.clientY }, false);
        }
    };
    const onTouchStart = (event: MapTouchEvent) => {
        const t = event.originalEvent.touches[0];
        if (event.originalEvent.touches.length === 1 && t) {
            onDown(event, { x: t.clientX, y: t.clientY }, true);
        }
    };

    const onClick = (event: MapMouseEvent) => {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        const edit = state().routeEdit;
        if (edit) {
            const index = hitWaypoint(map, event.point);
            const last = edit.line.waypoints.length - 1;
            if (index !== null) {
                if (edit.drawing) {
                    // клик по последней поставленной точке заканчивает рисование
                    if ((edit.drawing === 'end' && index === last) || (edit.drawing === 'start' && index === 0)) {
                        editing.stopDrawing();
                    }
                } else if (index === last || index === 0) {
                    editing.startDrawing(index === last ? 'end' : 'start');
                }
                return;
            }
            if (edit.drawing) {
                const anchor = edit.drawing === 'end' ? edit.line.waypoints.at(-1) : edit.line.waypoints[0];
                editing.click(nearTo(lngLat(event), anchor), event.originalEvent.altKey);
                // резинка теперь идёт от новой точки, а не от прежней
                rubberBand(lngLat(event));
                return;
            }
            if (hitEditLeg(map, event.point) !== null) {
                return;
            }
        }
        const track = hitTrack(map, event.point);
        if (track) {
            editing.start(track.trackId, track.segment);
            return;
        }
        if (edit) {
            editing.stop();
        }
    };

    const onDblClick = (event: MapMouseEvent) => {
        if (!state().routeEdit) {
            return;
        }
        const index = hitWaypoint(map, event.point);
        if (index !== null) {
            event.preventDefault();
            editing.removeWaypoint(index);
        }
    };

    const onMouseMove = (event: MapMouseEvent) => {
        const edit = state().routeEdit;
        const overWaypoint = edit !== null && !edit.drawing && hitWaypoint(map, event.point) !== null;
        updateCursor(map, store, editing, overWaypoint || dragging);
        rubberBand(lngLat(event));
    };
    const onMouseOut = () => rubberBand(null);

    const onKeyDown = (event: KeyboardEvent) => {
        const edit = state().routeEdit;
        const key = edit ? editorKey(event) : null;
        if (!key) {
            return;
        }
        if (key === 'undo') {
            editing.undo();
        } else if (key === 'redo') {
            editing.redo();
        } else if (key === 'backspace') {
            if (!edit?.drawing) {
                return;
            }
            editing.removeLastDrawn();
        } else if (edit?.drawing) {
            editing.stopDrawing();
        } else {
            editing.stop();
        }
        event.preventDefault();
    };

    // курсор следует за состоянием: рисование, ожидание маршрутов
    const unsubscribe = store.subscribe((next, prev) => {
        if (next.routeEdit !== prev.routeEdit || next.tracks !== prev.tracks) {
            updateCursor(map, store, editing, dragging);
        }
    });

    map.on('mousedown', onMouseDown);
    map.on('touchstart', onTouchStart);
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);
    document.addEventListener('keydown', onKeyDown);
    return () => {
        unsubscribe();
        map.off('mousedown', onMouseDown);
        map.off('touchstart', onTouchStart);
        map.off('click', onClick);
        map.off('dblclick', onDblClick);
        map.off('mousemove', onMouseMove);
        map.off('mouseout', onMouseOut);
        document.removeEventListener('keydown', onKeyDown);
    };
}

export function MapEditor() {
    const { current } = useMap();
    const store = useAppStoreApi();
    const editing = useRouteEditing();
    useEffect(() => {
        const map = current?.getMap();
        return map ? bind(map, store, editing) : undefined;
    }, [current, store, editing]);
    return null;
}
