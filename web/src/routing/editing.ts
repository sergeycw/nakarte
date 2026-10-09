import type { RoutingEngine } from '@/config';
import type { AppStore } from '@/state/store';
import { prepareImport } from '@/tracks/import-result';
import { geoData, type LatLng, type Track } from '@/tracks/model';
import { saveActivity } from './activity';
import { getActivity, RoutingError } from './brouter';
import { createRouteEditor, type End, type RouteEditor } from './editor';
import { fromSegment, type SegmentRoute, toSegment } from './line';
import { type Router, routerDownHint } from './router';

// Связь редактора со стором, без React — как createTrackActions (design add-web-route-editor, «Связь со стором и
// картой»). Редактор живёт дольше редактирования: после выхода он дожидается ответов роутера и хранит историю
// («История переживает выход из редактирования»). Редакторы лежат по массиву точек отрезка, который они последним
// записали в трек: любое внешнее изменение (разворот, удаление трека, новый трек из файла) даёт другой массив, и такой
// редактор выбрасывается — его ответ иначе затёр бы чужую правку, а история относилась бы к другой линии.

export type Notify = (title: string, type?: 'error' | 'success') => void;

export interface RouteEditingDeps {
    store: AppStore;
    router: Router;
    engine: RoutingEngine;
    notify: Notify;
    storage: Storage | null;
}

interface Session {
    trackId: string;
    editor: RouteEditor;
    // массив точек отрезка, который редактор последним записал в трек
    written: readonly LatLng[];
}

export function createRouteEditing({ store, router, engine, notify, storage }: RouteEditingDeps) {
    const state = () => store.getState();
    const sessions = new WeakMap<readonly LatLng[], Session>();
    let current: Session | null = null;
    let drawing: End | null = null;

    function findSegment(session: Session): { track: Track; index: number } | null {
        const track = state().tracks.find((item) => item.id === session.trackId);
        const index = track?.segments.indexOf(session.written as LatLng[]) ?? -1;
        return track && index >= 0 ? { track, index } : null;
    }

    function publish() {
        const located = current && findSegment(current);
        if (!current || !located) {
            state().setRouteEdit(null);
            return;
        }
        state().setRouteEdit({
            trackId: current.trackId,
            segment: located.index,
            line: current.editor.line(),
            drawing,
            canUndo: current.editor.canUndo(),
            canRedo: current.editor.canRedo(),
        });
    }

    // Линия изменилась (правка или ответ роутера, в том числе после выхода): записать отрезок и разметку в трек
    function write(session: Session) {
        const located = findSegment(session);
        if (!located) {
            discard(session);
            return;
        }
        const { track, index } = located;
        const { points, route } = toSegment(session.editor.line());
        sessions.delete(session.written);
        session.written = points;
        sessions.set(points, session);
        const segments = track.segments.slice();
        segments[index] = points;
        const routes = segments.map((_, i) => (i === index ? route : (track.routes?.[i] ?? null)));
        state().updateTrack(track.id, { segments, routes });
        if (session === current) {
            publish();
        }
    }

    function discard(session: Session) {
        sessions.delete(session.written);
        session.editor.dispose();
        if (session === current) {
            current = null;
            drawing = null;
            state().setRoutePreview(null);
            publish();
        }
    }

    function onRouteError(error: unknown) {
        if (error instanceof RoutingError && error.unreachable) {
            // одно предупреждение на переход «работал → упал» (спека routing, «Недоступный роутер»)
            if (state().routerReachable) {
                state().setRouterReachable(false);
                notify(`${routerDownHint(engine)}. Lines stay straight until then.`, 'error');
            }
            return;
        }
        notify(`Routing failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }

    function session(trackId: string, points: readonly LatLng[], route: SegmentRoute | null) {
        const existing = sessions.get(points);
        if (existing && existing.trackId === trackId) {
            return existing;
        }
        const created: Session = {
            trackId,
            written: points,
            editor: createRouteEditor(fromSegment(points, route), {
                route: (from, to, activityId, signal) => {
                    const activity = getActivity(activityId);
                    if (!activity) {
                        return Promise.reject(new RoutingError(`unknown activity ${activityId}`));
                    }
                    return router.route(from, to, activity, signal);
                },
                onChange: () => write(created),
                onRouteError,
                onRouted: () => state().setRouterReachable(true),
            }),
        };
        sessions.set(points, created);
        return created;
    }

    // Отрезок без двух точек удаляется, трек без отрезков и точек — тоже (onLineEditEnd старого клиента)
    function cleanUp(finished: Session) {
        const located = findSegment(finished);
        if (!located) {
            return;
        }
        const { track, index } = located;
        if (track.segments[index].length >= 2) {
            return;
        }
        sessions.delete(finished.written);
        finished.editor.dispose();
        const segments = track.segments.filter((_, i) => i !== index);
        if (segments.length === 0 && track.points.length === 0) {
            state().removeTracks([track.id]);
            return;
        }
        state().updateTrack(track.id, {
            segments,
            routes: segments.map((_, i) => track.routes?.[i < index ? i : i + 1] ?? null),
        });
    }

    function stop() {
        const finished = current;
        current = null;
        drawing = null;
        state().setRoutePreview(null);
        publish();
        if (finished) {
            cleanUp(finished);
        }
    }

    function start(trackId: string, segment: number, startDrawing: End | null = null) {
        const track = state().tracks.find((item) => item.id === trackId);
        const points = track?.segments[segment];
        if (!track || !points) {
            return;
        }
        const next = session(trackId, points, track.routes?.[segment] ?? null);
        if (current && current !== next) {
            stop();
        }
        current = next;
        drawing = startDrawing;
        publish();
    }

    // Трек скрыли, удалили или изменили снаружи во время редактирования — редактирование заканчивается
    store.subscribe((next, prev) => {
        if (!current || next.tracks === prev.tracks) {
            return;
        }
        const located = findSegment(current);
        if (!located) {
            discard(current);
        } else if (!located.track.visible) {
            stop();
        }
    });

    const editor = () => current?.editor ?? null;

    function addSegment(trackId: string) {
        const track = state().tracks.find((item) => item.id === trackId);
        if (!track) {
            return;
        }
        if (!track.visible) {
            state().updateTrack(trackId, { visible: true });
        }
        const segments = [...track.segments, []];
        state().updateTrack(trackId, {
            segments,
            routes: segments.map((_, i) => track.routes?.[i] ?? null),
        });
        start(trackId, segments.length - 1, 'end');
    }

    return {
        start,
        stop,
        addSegment,
        // «New track»: трек и сразу рисование (addTrackAndEdit старого клиента)
        newTrack(name: string) {
            const [track] = state().addTracks(prepareImport([geoData(name || 'New track')], true).tracks);
            addSegment(track.id);
        },
        isEditing: (trackId?: string) => current !== null && (trackId === undefined || current.trackId === trackId),
        drawing: () => drawing,
        startDrawing(end: End) {
            if (current) {
                drawing = end;
                publish();
            }
        },
        stopDrawing() {
            drawing = null;
            state().setRoutePreview(null);
            publish();
        },
        // клик по карте при рисовании; alt — прямой отрезок без роутера
        click(latlng: LatLng, alt = false) {
            if (drawing) {
                editor()?.addWaypoint(drawing, latlng, alt ? null : state().routingActivity);
            }
        },
        removeLastDrawn() {
            if (drawing) {
                editor()?.removeEndWaypoint(drawing);
            }
        },
        moveWaypoint: (index: number, latlng: LatLng) => editor()?.moveWaypoint(index, latlng),
        removeWaypoint: (index: number) => editor()?.removeWaypoint(index),
        insertWaypoint: (leg: number, latlng: LatLng) => editor()?.insertWaypoint(leg, latlng) ?? -1,
        undo: () => editor()?.undo(),
        redo: () => editor()?.redo(),
        pending: () => editor()?.pending() ?? 0,

        setActivity(id: string | null) {
            state().setRoutingActivity(id);
            saveActivity(storage, id);
            if (id) {
                router.warmUp();
            }
        },
        // при загрузке страницы с выбранной активностью движок прогревается сразу (спека browser-routing-engine)
        warmUp() {
            if (state().routingActivity) {
                router.warmUp();
            }
        },
        // режим и состояние движка для кнопки прокладки (useSyncExternalStore)
        engine,
        engineStatus: () => router.status(),
        subscribeEngine: (listener: () => void) => router.subscribe(listener),
        async checkRouter() {
            const reachable = await router.isReachable();
            state().setRouterReachable(reachable);
        },
    };
}

export type RouteEditing = ReturnType<typeof createRouteEditing>;
