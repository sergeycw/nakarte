import { useMap } from '@vis.gl/react-maplibre';
import type { Point } from 'geojson';
import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent, MapTouchEvent, PointLike } from 'maplibre-gl';
import { useEffect } from 'react';
import { useAppStoreApi } from '@/state/context';
import type { AppStore, MenuTarget, RouteEditState } from '@/state/store';
import type { TrackActions } from '@/tracks/actions';
import { useTrackActions } from '@/tracks/actions-context';
import { distance } from '@/tracks/geometry';
import { type LatLng, TRACK_COLORS, type Waypoint } from '@/tracks/model';
import { TRACK_LINES, TRACK_POINTS, TRACK_UNROUTED } from '@/tracks/style';
import { EDIT_PREVIEW, EDIT_WAYPOINTS, previewData, toolPreviewData, waypointRole } from './edit-style';
import type { RouteEditing } from './editing';
import { useRouteEditing } from './editing-context';
import type { End } from './editor';
import { legPath } from './line';
import { type LinePlace, nearestLink, shortcutRemoved } from './line-tools';

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
// - превью перетаскивания и резинка — setData источника превью мимо стиля (edit-style.ts);
// - инструменты линии и точки трека (design add-web-line-tools): правый клик и долгое нажатие открывают меню, клик по
//   точке трека — меню точки, выбор Join и Shortcut и режимы точек забирают клики по карте себе.

// допуск попадания по точке и линии, px: кружок опорной точки — радиус 6 + обводка 2; по линии для вставки — 7 px в
// обе стороны от тонкой линии редактора
const HIT_RADIUS = 9;
const LINE_HIT = 7;
// после касания браузер присылает совместимые mousedown/mouseup/click: mousedown в это время — эхо тапа, а не жест
const TOUCH_ECHO_MS = 800;
// клик сразу после перетаскивания или вставки — конец того же жеста
const CLICK_AFTER_GESTURE_MS = 400;
// долгое нажатие пальцем — меню; сдвиг больше DRAG_THRESHOLD px до него — перетаскивание (design add-web-line-tools,
// «Меню на карте»: contextmenu на телефоне ненадёжен, iOS Safari его не шлёт)
const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 3;
const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

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

// Точка трека под курсором — по отрисованному кадру, как линии треков: номер точки — свойство фичи (tracks/style.ts)
function trackPointAt(
    map: MaplibreMap,
    store: AppStore,
    point: ScreenPoint,
): { trackId: string; point: Waypoint } | null {
    const box: [PointLike, PointLike] = [
        [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
        [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
    ];
    const [feature] = map.queryRenderedFeatures(box, { layers: [TRACK_POINTS] });
    if (!feature) {
        return null;
    }
    const trackId = feature.properties.id as string;
    const found = store.getState().tracks.find((track) => track.id === trackId)?.points[
        feature.properties.index as number
    ];
    // кадр мог отстать от стора (точку только что удалили, номера сдвинулись): под номером должна быть та же точка
    const [lng, lat] = (feature.geometry as Point).coordinates;
    const same =
        found && found.name === feature.properties.name && Math.abs(found.lat - lat) + Math.abs(found.lng - lng) < 1e-5;
    return same ? { trackId, point: found } : null;
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

function bind(map: MaplibreMap, store: AppStore, editing: RouteEditing, actions: TrackActions): () => void {
    const state = () => store.getState();
    let suppressClickUntil = 0;
    let lastTouch = Number.NEGATIVE_INFINITY;
    let touching = false;
    let dragging = false;
    // на это касание редактор взвёл своё долгое нажатие (палец на опорной точке или на отрезке): contextmenu MapLibre
    // на тот же жест не нужен — оба таймера по 500 мс. Сбрасывается с концом касания.
    let ownLongPress = false;

    // место на редактируемой линии под точкой экрана: опорная точка или отрезок
    function placeAt(edit: RouteEditState, point: ScreenPoint, latlng: LatLng): LinePlace | null {
        const index = waypointAt(map, edit, point);
        if (index !== null) {
            return { waypoint: index };
        }
        const leg = legAt(map, edit, point);
        return leg === null ? null : { leg, latlng: nearTo(latlng, edit.line.waypoints[leg]) };
    }

    // Что под меню: опорная точка или отрезок редактируемой линии, точка трека, линия трека (её редактирование
    // начинается). null — меню нет.
    function menuTarget(point: ScreenPoint, latlng: LatLng): MenuTarget | null {
        let edit = state().routeEdit;
        const place = edit && placeAt(edit, point, latlng);
        if (place) {
            return 'waypoint' in place ? { kind: 'waypoint', index: place.waypoint } : { kind: 'line', place };
        }
        const trackPoint = trackPointAt(map, store, point);
        if (trackPoint) {
            return { kind: 'point', ...trackPoint };
        }
        const track = hitTrack(map, point);
        if (!track) {
            return null;
        }
        editing.start(track.trackId, track.segment);
        edit = state().routeEdit;
        const leg = edit && legAt(map, edit, point);
        return edit && leg !== null && leg !== undefined
            ? { kind: 'line', place: { leg, latlng: nearTo(latlng, edit.line.waypoints[leg]) } }
            : null;
    }

    function openMenu(point: ScreenPoint, latlng: LatLng, client: ScreenPoint): boolean {
        const target = menuTarget(point, latlng);
        if (!target) {
            return false;
        }
        setPreview(null);
        editing.openMenu(client.x, client.y, target);
        return true;
    }

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
        } else if (edit?.drawing || state().lineTool || state().pointTool) {
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
        // палец на опорной точке без сдвига — меню точки, а не перетаскивание
        if (touch && !inserted) {
            ownLongPress = true;
        }
        const longPress =
            touch && !inserted
                ? window.setTimeout(() => {
                      if (moved) {
                          return;
                      }
                      finish();
                      menuAfterLongPress(() =>
                          editing.openMenu(clientStart.x, clientStart.y, { kind: 'waypoint', index }),
                      );
                  }, LONG_PRESS_MS)
                : undefined;

        function move(clientX: number, clientY: number) {
            if (!moved && Math.hypot(clientX - clientStart.x, clientY - clientStart.y) < DRAG_THRESHOLD) {
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
        function finish() {
            window.clearTimeout(longPress);
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
        }
        if (touch) {
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', finish);
            window.addEventListener('touchcancel', finish);
        } else {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', finish);
        }
    }

    // Меню после долгого нажатия. Отпускание пальца — конец того же жеста: preventDefault у touchend гасит совместимые
    // mousedown/click, которые браузер иначе пришлёт после касания, — mousedown меню Base UI считает нажатием снаружи
    // и закрывается (useDismiss, outsidePressEvent 'sloppy'), а click карты поставил бы точку.
    function menuAfterLongPress(open: () => void) {
        setPreview(null);
        open();
        // жест может кончиться touchcancel: тогда слушатель touchend снимается, иначе он погасил бы следующий тап
        const onEnd = (event: TouchEvent) => {
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('touchcancel', onEnd);
            if (event.type === 'touchend') {
                event.preventDefault();
                suppressClickUntil = performance.now() + CLICK_AFTER_GESTURE_MS;
            }
        };
        window.addEventListener('touchend', onEnd, { passive: false });
        window.addEventListener('touchcancel', onEnd);
    }

    // Касание отрезка: точка вставляется не сразу, а при сдвиге пальца (вставка и перетаскивание) или при отпускании до
    // LONG_PRESS_MS (тап — вставка, как мышью); долгое нажатие без сдвига — меню линии (design add-web-line-tools)
    function touchOnLeg(leg: number, latlng: LatLng, clientStart: ScreenPoint) {
        let done = false;
        ownLongPress = true;
        const cleanup = () => {
            done = true;
            window.clearTimeout(timer);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('touchcancel', onCancel);
        };
        const insert = () => {
            cleanup();
            return editing.insertWaypoint(leg, latlng);
        };
        const onMove = (event: TouchEvent) => {
            const t = event.touches[0];
            if (!t || Math.hypot(t.clientX - clientStart.x, t.clientY - clientStart.y) < DRAG_THRESHOLD) {
                return;
            }
            event.preventDefault();
            const inserted = insert();
            if (inserted >= 0) {
                startDrag(inserted, true, clientStart, true);
            }
        };
        const onEnd = () => {
            if (insert() >= 0) {
                suppressClickUntil = performance.now() + CLICK_AFTER_GESTURE_MS;
            }
        };
        const onCancel = () => cleanup();
        const timer = window.setTimeout(() => {
            if (done) {
                return;
            }
            cleanup();
            menuAfterLongPress(() =>
                editing.openMenu(clientStart.x, clientStart.y, { kind: 'line', place: { leg, latlng } }),
            );
        }, LONG_PRESS_MS);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchcancel', onCancel);
    }

    function onDown(event: MapMouseEvent | MapTouchEvent, client: ScreenPoint, touch: boolean) {
        const edit = state().routeEdit;
        // выбор на карте и режимы точек забирают клики себе, нажатие только двигает карту
        if (!edit || dragging || state().lineTool || state().pointTool || state().mapMenu) {
            return;
        }
        const index = waypointAt(map, edit, event.point);
        if (index !== null) {
            event.preventDefault();
            startDrag(index, false, client, touch);
            return;
        }
        // точка трека на линии: нажатие на неё точку линии не вставляет, иначе до меню точки не добраться
        if (edit.drawing || trackPointAt(map, store, event.point)) {
            return;
        }
        const leg = legAt(map, edit, event.point);
        if (leg === null) {
            return;
        }
        event.preventDefault();
        const latlng = nearTo(lngLat(event), edit.line.waypoints[leg]);
        if (touch) {
            touchOnLeg(leg, latlng, client);
            return;
        }
        const inserted = editing.insertWaypoint(leg, latlng);
        if (inserted >= 0) {
            startDrag(inserted, true, client, touch);
        }
    }

    const onMouseDown = (event: MapMouseEvent) => {
        // Ctrl+клик на macOS — правый клик: mousedown приходит с button 0, и без этой проверки он вставил бы точку и
        // начал перетаскивание, а contextmenu отбросился бы
        const macContextClick = event.originalEvent.ctrlKey && MAC;
        if (event.originalEvent.button !== 0 || macContextClick || performance.now() - lastTouch < TOUCH_ECHO_MS) {
            return;
        }
        onDown(event, { x: event.originalEvent.clientX, y: event.originalEvent.clientY }, false);
    };
    const onTouchStart = (event: MapTouchEvent) => {
        lastTouch = performance.now();
        touching = true;
        ownLongPress = false;
        const t = event.originalEvent.touches[0];
        if (event.originalEvent.touches.length === 1 && t) {
            onDown(event, { x: t.clientX, y: t.clientY }, true);
        }
    };

    const onTouchEnd = () => {
        lastTouch = performance.now();
        touching = false;
        ownLongPress = false;
    };

    // Правый клик (contextmenu MapLibre): меню опорной точки, линии или точки трека; preventDefault у события браузера
    // гасит его собственное меню. Во время касания contextmenu карты — долгое нажатие самого MapLibre (родное событие
    // браузера при касании MapLibre гасит, ui/handler/map_event.ts); сразу после касания — эхо.
    const onContextMenu = (event: MapMouseEvent) => {
        const client = { x: event.originalEvent.clientX, y: event.originalEvent.clientY };
        if (touching) {
            // долгое нажатие, которое посчитал сам MapLibre (палец на линии вне редактирования, на отрезке во время
            // рисования): своего таймера у редактора на этот жест нет
            event.originalEvent.preventDefault();
            if (!ownLongPress && !dragging && !state().pointTool && !state().lineTool) {
                menuAfterLongPress(() => openMenu(event.point, lngLat(event), client));
            }
            return;
        }
        if (performance.now() - lastTouch < TOUCH_ECHO_MS || dragging) {
            event.originalEvent.preventDefault();
            return;
        }
        if (state().pointTool) {
            return;
        }
        if (openMenu(event.point, lngLat(event), client)) {
            event.originalEvent.preventDefault();
        }
    };

    // Клик в режиме точек трека: поставить точку или перенести (createNewPoint, movePoint старого клиента)
    function pointToolClick(latlng: LatLng): boolean {
        const tool = state().pointTool;
        if (!tool) {
            return false;
        }
        if (tool.kind === 'add') {
            actions.addPoint(tool.trackId, latlng);
        } else {
            actions.movePoint(tool.trackId, tool.point, latlng);
        }
        return true;
    }

    // Join: ближний к клику конец отрезка по расстоянию (isPointCloserToStart старого клиента)
    function nearerEnd(trackId: string, segment: number, latlng: LatLng): { end: End; point: LatLng } | null {
        const points = state().tracks.find((track) => track.id === trackId)?.segments[segment];
        const first = points?.[0];
        const last = points?.at(-1);
        if (!first || !last) {
            return null;
        }
        return distance(latlng, first) < distance(latlng, last)
            ? { end: 'start', point: first }
            : { end: 'end', point: last };
    }

    // Клик при выборе Join или Shortcut; клик мимо — отмена (map.on('click', hideLineCursor) старого клиента)
    function lineToolClick(edit: RouteEditState, point: ScreenPoint, latlng: LatLng): boolean {
        const tool = state().lineTool;
        if (!tool) {
            return false;
        }
        if (tool.kind === 'join') {
            const track = hitTrack(map, point);
            const end = track && nearerEnd(track.trackId, track.segment, latlng);
            if (track && end) {
                editing.join(track.trackId, track.segment, end.end);
            } else {
                editing.cancelTool();
            }
        } else {
            const place = placeAt(edit, point, latlng);
            // место, после которого удалять нечего, — ничего, выбор продолжается
            if (!place) {
                editing.cancelTool();
            } else {
                editing.shortcut(place);
            }
        }
        setPreview(null);
        return true;
    }

    const onClick = (event: MapMouseEvent) => {
        if (performance.now() < suppressClickUntil || state().mapMenu) {
            return;
        }
        if (pointToolClick(lngLat(event))) {
            return;
        }
        const edit = state().routeEdit;
        if (edit && lineToolClick(edit, event.point, lngLat(event))) {
            return;
        }
        const trackPoint = edit?.drawing ? null : trackPointAt(map, store, event.point);
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
            if (trackPoint) {
                openPointMenu(trackPoint, event);
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
        if (trackPoint) {
            openPointMenu(trackPoint, event);
            return;
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

    // меню точки трека — по клику (onMarkerClick старого клиента: и левый, и правый)
    function openPointMenu(target: { trackId: string; point: Waypoint }, event: MapMouseEvent) {
        editing.openMenu(event.originalEvent.clientX, event.originalEvent.clientY, { kind: 'point', ...target });
    }

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
        if (edit && state().lineTool) {
            toolPreview(edit, event.point, lngLat(event));
            return;
        }
        updateCursor(edit !== null && !edit.drawing && waypointUnderCursor(map, event.point));
        rubberBand(lngLat(event));
    };

    // Превью выбора Join и Shortcut: линия от начала к курсору (над допустимым местом — зелёная и прилипает к нему),
    // у Shortcut — ещё удаляемый участок
    function toolPreview(edit: RouteEditState, point: ScreenPoint, cursor: LatLng) {
        const tool = state().lineTool;
        if (!tool) {
            return;
        }
        if (tool.kind === 'join') {
            const anchor = tool.end === 'end' ? edit.line.waypoints.at(-1) : edit.line.waypoints[0];
            const track = hitTrack(map, point);
            const end = track && nearerEnd(track.trackId, track.segment, cursor);
            if (anchor) {
                setPreview(toolPreviewData([anchor, end ? end.point : nearTo(cursor, anchor)], Boolean(end)));
            }
            return;
        }
        const from = placePoint(edit, tool.from);
        if (!from) {
            return;
        }
        const to = placeAt(edit, point, cursor);
        const removed = to && shortcutRemoved(edit.line, tool.from, to);
        const end = to && removed ? placePoint(edit, to) : null;
        setPreview(toolPreviewData([from, end ?? nearTo(cursor, from)], Boolean(removed), removed));
    }

    // точка места на линии: опорная точка или проекция на ближайшее звено
    function placePoint(edit: RouteEditState, place: LinePlace): LatLng | null {
        if ('waypoint' in place) {
            return edit.line.waypoints[place.waypoint] ?? null;
        }
        return edit.line.legs[place.leg] ? nearestLink(edit.line, place.leg, place.latlng).point : null;
    }
    const onMouseOut = () => rubberBand(null);

    const onKeyDown = (event: KeyboardEvent) => {
        // открытое меню карты клавиши забирает себе (Escape закрывает его, а не редактирование)
        if (state().mapMenu) {
            return;
        }
        if (toolKey(event)) {
            event.preventDefault();
            return;
        }
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

    // Escape (и Enter у выбора на карте) выходит из режима точек и выбора Join/Shortcut; остальные клавиши редактора
    // во время выбора не действуют: правка линии сдвинула бы номер точки, от которой он идёт
    function toolKey(event: KeyboardEvent): boolean {
        const { lineTool, pointTool, routeEdit } = state();
        if (!lineTool && !pointTool) {
            return false;
        }
        const key = editorKey(event, map.getContainer());
        if (pointTool && key === 'escape') {
            actions.stopPointTool();
            return true;
        }
        if (lineTool && routeEdit && key) {
            if (key === 'escape' || key === 'enter') {
                editing.cancelTool();
                setPreview(null);
            }
            return true;
        }
        return false;
    }

    // курсор следует за состоянием: рисование, ожидание маршрутов
    const unsubscribe = store.subscribe((next, prev) => {
        if (next.lineTool !== prev.lineTool && !next.lineTool) {
            setPreview(null);
        }
        if (
            next.routeEdit !== prev.routeEdit ||
            next.tracks !== prev.tracks ||
            next.lineTool !== prev.lineTool ||
            next.pointTool !== prev.pointTool
        ) {
            updateCursor(false);
        }
    });

    map.on('mousedown', onMouseDown);
    map.on('touchstart', onTouchStart);
    map.on('touchend', onTouchEnd);
    map.on('touchcancel', onTouchEnd);
    map.on('contextmenu', onContextMenu);
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);
    document.addEventListener('keydown', onKeyDown);
    return () => {
        unsubscribe();
        map.off('mousedown', onMouseDown);
        map.off('touchstart', onTouchStart);
        map.off('touchend', onTouchEnd);
        map.off('touchcancel', onTouchEnd);
        map.off('contextmenu', onContextMenu);
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
    const actions = useTrackActions();
    useEffect(() => {
        const map = current?.getMap();
        return map ? bind(map, store, editing, actions) : undefined;
    }, [current, store, editing, actions]);
    return null;
}
