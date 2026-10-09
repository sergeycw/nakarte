import { useMap } from '@vis.gl/react-maplibre';
import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent, MapTouchEvent, PointLike } from 'maplibre-gl';
import { useEffect } from 'react';
import { useAppStoreApi } from '@/state/context';
import type { AppStore, RouteEditState } from '@/state/store';
import { type LatLng, TRACK_COLORS } from '@/tracks/model';
import { TRACK_LINES, TRACK_UNROUTED } from '@/tracks/style';
import { EDIT_PREVIEW, EDIT_WAYPOINTS, previewData, waypointRole } from './edit-style';
import type { RouteEditing } from './editing';
import { useRouteEditing } from './editing-context';
import { legPath } from './line';

// События карты для редактора (design add-web-route-editor, «События карты»). Компонент внутри <Map>: обработчики
// MapLibre и document вешаются один раз, текущее состояние читается из стора в момент события.
//
// - клик: опорная точка (крайняя начинает рисование от своего конца, последняя поставленная заканчивает его), при
//   рисовании — новая точка (Alt — прямой отрезок), без рисования — по линии трека начать редактирование, мимо линии
//   закончить;
// - нажатие на опорную точку — перетаскивание, на линию (не при рисовании) — вставка точки и её перетаскивание;
//   preventDefault у mousedown/touchstart MapLibre выключает панораму карты на этот жест (ui/handler/map_event.ts);
// - двойной клик по опорной точке — удаление, preventDefault гасит зум;
// - клавиши на keydown: на macOS, пока зажат Cmd, keyup других клавиш не приходит (AGENTS.md, «Где код роутинга»);
// - превью перетаскивания и резинка — setData источника превью мимо стиля (edit-style.ts).

// допуск попадания по точке и линии, px: кружок опорной точки — радиус 6 + обводка 2; по линии для вставки — 7 px в
// обе стороны от тонкой линии редактора
const HIT_RADIUS = 9;
const LINE_HIT = 7;
// после касания браузер присылает совместимые mousedown/mouseup/click: mousedown в это время — эхо тапа, а не жест
const TOUCH_ECHO_MS = 800;
// клик сразу после перетаскивания или вставки — конец того же жеста
const CLICK_AFTER_GESTURE_MS = 400;

export type EditorKey = 'undo' | 'redo' | 'backspace' | 'escape' | 'enter';

// Хоткеи редактора по event.code — от раскладки не зависят. В полях ввода, меню и окнах редактор клавиши не трогает;
// Enter — только на карте или без фокуса: на кнопке в фокусе Enter — нажатие этой кнопки.
export function editorKey(event: KeyboardEvent, map?: HTMLElement): EditorKey | null {
    if (event.defaultPrevented) {
        return null;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
        target &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
            target.closest('[role="menu"], [role="dialog"], [role="listbox"]'))
    ) {
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
    if (event.key === 'Escape') {
        return 'escape';
    }
    if (event.key === 'Enter' && (!target || target === document.body || map?.contains(target))) {
        return 'enter';
    }
    return null;
}

type ScreenPoint = { x: number; y: number };

function sqDistToSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dot = dx * dx + dy * dy;
    const t = dot > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / dot)) : 0;
    return (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
}

// Попадание по опорной точке и отрезку для кликов и нажатий считается по линии из стора, а не по отрисованному кадру:
// данные источника доходят до кадра через воркер MapLibre, и быстрый второй клик по только что поставленной точке
// queryRenderedFeatures ещё не видит.
function waypointAt(map: MaplibreMap, edit: RouteEditState, point: ScreenPoint): number | null {
    let best: number | null = null;
    let bestDistance = HIT_RADIUS ** 2;
    edit.line.waypoints.forEach((waypoint, index) => {
        const projected = map.project([waypoint.lng, waypoint.lat]);
        const d = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
        if (d <= bestDistance) {
            bestDistance = d;
            best = index;
        }
    });
    return best;
}

function legAt(map: MaplibreMap, edit: RouteEditState, point: ScreenPoint): number | null {
    let best: number | null = null;
    let bestDistance = LINE_HIT ** 2;
    edit.line.legs.forEach((leg, index) => {
        if (leg.state === 'pending') {
            return;
        }
        const path = legPath(edit.line, index).map((p) => map.project([p.lng, p.lat]));
        for (let k = 0; k < path.length - 1; k++) {
            const d = sqDistToSegment(point, path[k], path[k + 1]);
            if (d <= bestDistance) {
                bestDistance = d;
                best = index;
            }
        }
    });
    return best;
}

// Курсор при наведении — по отрисованному кадру: дёшево (пространственный индекс), а отставание на кадр незаметно
function waypointUnderCursor(map: MaplibreMap, point: ScreenPoint): boolean {
    const box: [PointLike, PointLike] = [
        [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
        [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
    ];
    return map.queryRenderedFeatures(box, { layers: [EDIT_WAYPOINTS] }).length > 0;
}

function hitTrack(map: MaplibreMap, point: ScreenPoint): { trackId: string; segment: number } | null {
    const box: [PointLike, PointLike] = [
        [point.x - 5, point.y - 5],
        [point.x + 5, point.y + 5],
    ];
    const [feature] = map.queryRenderedFeatures(box, { layers: [TRACK_LINES, TRACK_UNROUTED] });
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

function editColor(store: AppStore): string {
    const { routeEdit, tracks } = store.getState();
    return TRACK_COLORS[tracks.find((track) => track.id === routeEdit?.trackId)?.color ?? 0];
}

function bind(map: MaplibreMap, store: AppStore, editing: RouteEditing): () => void {
    const state = () => store.getState();
    let suppressClickUntil = 0;
    let lastTouch = Number.NEGATIVE_INFINITY;
    let dragging = false;

    function setPreview(data: ReturnType<typeof previewData> | null) {
        (map.getSource(EDIT_PREVIEW) as GeoJSONSource | undefined)?.setData(data ?? previewData([], ''));
    }

    function updateCursor(overWaypoint: boolean) {
        const edit = state().routeEdit;
        let cursor = '';
        if (overWaypoint || dragging) {
            cursor = 'move';
        } else if (editing.pending() > 0) {
            // пока идут запросы, курсор показывает ожидание (спека route-editing, «Клик при рисовании»)
            cursor = 'progress';
        } else if (edit?.drawing) {
            cursor = 'crosshair';
        }
        map.getCanvas().style.cursor = cursor;
    }

    function rubberBand(cursor: LatLng | null) {
        if (dragging) {
            return;
        }
        const edit = state().routeEdit;
        const anchor = edit?.drawing === 'end' ? edit.line.waypoints.at(-1) : edit?.line.waypoints[0];
        if (!edit?.drawing || !cursor || !anchor) {
            setPreview(null);
            return;
        }
        setPreview(previewData([[anchor, nearTo(cursor, anchor)]], editColor(store)));
    }

    function startDrag(index: number, inserted: boolean, clientStart: ScreenPoint, touch: boolean) {
        const edit = state().routeEdit;
        const origin = edit?.line.waypoints[index];
        if (!edit || !origin) {
            return;
        }
        dragging = true;
        const { waypoints } = edit.line;
        const role = waypointRole(index, waypoints.length);
        const color = editColor(store);
        const neighbours = [waypoints[index - 1], waypoints[index + 1]].filter((p): p is LatLng => Boolean(p));
        let latlng = origin;
        let moved = false;
        const canvas = map.getCanvasContainer();

        function move(clientX: number, clientY: number) {
            if (!moved && Math.hypot(clientX - clientStart.x, clientY - clientStart.y) < 3) {
                return;
            }
            if (!moved) {
                // точка и её отрезки уходят из источников линии — их рисует превью
                state().setRouteDrag(index);
            }
            moved = true;
            const rect = canvas.getBoundingClientRect();
            const point = map.unproject([clientX - rect.left, clientY - rect.top]);
            latlng = nearTo({ lat: point.lat, lng: point.lng }, origin);
            setPreview(
                previewData(
                    neighbours.map((p) => [p, latlng]),
                    color,
                    { latlng, role },
                ),
            );
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
            setPreview(null);
            state().setRouteDrag(null);
            // точка всё ещё та же: за время жеста линию могли поменять (ответ роутера не меняет опорные точки, а
            // undo с клавиатуры клавиши редактора во время перетаскивания не пускают — проверка на всякий случай)
            if (moved && state().routeEdit?.line.waypoints[index] === origin) {
                editing.moveWaypoint(index, latlng);
            }
            if (moved || inserted) {
                suppressClickUntil = performance.now() + CLICK_AFTER_GESTURE_MS;
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

    function onDown(event: MapMouseEvent | MapTouchEvent, client: ScreenPoint, touch: boolean) {
        const edit = state().routeEdit;
        if (!edit || dragging) {
            return;
        }
        const index = waypointAt(map, edit, event.point);
        if (index !== null) {
            event.preventDefault();
            startDrag(index, false, client, touch);
            return;
        }
        if (edit.drawing) {
            return;
        }
        const leg = legAt(map, edit, event.point);
        if (leg !== null) {
            event.preventDefault();
            const inserted = editing.insertWaypoint(leg, nearTo(lngLat(event), edit.line.waypoints[leg]));
            if (inserted >= 0) {
                startDrag(inserted, true, client, touch);
            }
        }
    }

    const onMouseDown = (event: MapMouseEvent) => {
        if (event.originalEvent.button !== 0 || performance.now() - lastTouch < TOUCH_ECHO_MS) {
            return;
        }
        onDown(event, { x: event.originalEvent.clientX, y: event.originalEvent.clientY }, false);
    };
    const onTouchStart = (event: MapTouchEvent) => {
        lastTouch = performance.now();
        const t = event.originalEvent.touches[0];
        if (event.originalEvent.touches.length === 1 && t) {
            onDown(event, { x: t.clientX, y: t.clientY }, true);
        }
    };

    const onClick = (event: MapMouseEvent) => {
        if (performance.now() < suppressClickUntil) {
            return;
        }
        const edit = state().routeEdit;
        if (edit) {
            const index = waypointAt(map, edit, event.point);
            const last = edit.line.waypoints.length - 1;
            if (index !== null) {
                if (edit.drawing) {
                    // клик по последней поставленной точке заканчивает рисование
                    if ((edit.drawing === 'end' && index === last) || (edit.drawing === 'start' && index === 0)) {
                        editing.stopDrawing();
                        setPreview(null);
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
            if (legAt(map, edit, event.point) !== null) {
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
        const edit = state().routeEdit;
        if (!edit) {
            return;
        }
        const index = waypointAt(map, edit, event.point);
        if (index !== null) {
            event.preventDefault();
            editing.removeWaypoint(index);
        }
    };

    const onMouseMove = (event: MapMouseEvent) => {
        // во время перетаскивания курсор и превью ведёт сам жест
        if (dragging) {
            return;
        }
        const edit = state().routeEdit;
        updateCursor(edit !== null && !edit.drawing && waypointUnderCursor(map, event.point));
        rubberBand(lngLat(event));
    };
    const onMouseOut = () => rubberBand(null);

    const onKeyDown = (event: KeyboardEvent) => {
        const edit = state().routeEdit;
        // во время перетаскивания линия не меняется с клавиатуры: номер перетаскиваемой точки должен остаться верным
        const key = edit && !dragging ? editorKey(event, map.getContainer()) : null;
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
            setPreview(null);
        } else {
            editing.stop();
        }
        event.preventDefault();
    };

    // курсор следует за состоянием: рисование, ожидание маршрутов
    const unsubscribe = store.subscribe((next, prev) => {
        if (next.routeEdit !== prev.routeEdit || next.tracks !== prev.tracks) {
            updateCursor(false);
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
