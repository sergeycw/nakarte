import { reverseRoute, settledRoute } from '@/routing/line';
import type { AppStore } from '@/state/store';
import type { TrackParams } from '@/state/sync';
import { EmptyTrackError, exportTrack, exportZip, saveFile } from './export';
import { boundsOf, wrapLng } from './geometry';
import { prepareImport } from './import-result';
import { loadFromUrl } from './import-url';
import { loadTrackParam } from './links';
import { type GeoData, geoData, type LatLng, type Track, type Waypoint } from './model';
import { parseGeoFile } from './parsers';
import { ShareError, shareBody, shareLink, storeTracks } from './share';
import type { TrackSources } from './sources';

// Действия списка треков без React: компоненты зовут их, тесты подставляют сеть, буфер обмена и уведомления.

export type Notify = (title: string, type?: 'error' | 'success') => void;

export interface TrackActionsDeps {
    store: AppStore;
    sources: TrackSources;
    notify: Notify;
    location: () => { origin: string; pathname: string; hash: string };
    // запись в буфер обмена; получает промис ссылки сразу, в обработчике клика (design add-web-tracks, «Ссылка — после ответа хранилища»)
    writeClipboard?: (text: Promise<string>) => Promise<void>;
    // конец восстановления автосохранения: треки из адреса и файлов встают после восстановленных (design
    // add-web-autosave, «Восстановление и треки из адреса»)
    restored?: Promise<unknown>;
}

// ClipboardItem с промисом: Safari сохраняет жест пользователя на время запроса к хранилищу, Chromium ждёт промис
export function writeClipboardItem(text: Promise<string>): Promise<void> {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
    return navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
}

// Название новой точки трека — следующий трёхзначный номер после наибольшего среди названий вида «001…» (у
// getNewPointName старого клиента — после последнего по порядку, и после переименований номер мог повториться); после
// 999 — пустое, как у старого
export function nextPointName(points: readonly Waypoint[]): string {
    let max = 0;
    for (const point of points) {
        if (/^\d{3}([^\d.]|$)/u.test(point.name)) {
            max = Math.max(max, Number.parseInt(point.name, 10));
        }
    }
    return max >= 999 ? '' : String(max + 1).padStart(3, '0');
}

// Долгота клика в соседней копии мира MapLibre — в ±180 (latlng.wrap() старого клиента). Долгота в пределах не
// трогается: арифметика wrapLng даёт ей шум в последнем знаке (44.8 → 44.799999999999955).
function wrapped(latlng: LatLng): LatLng {
    return latlng.lng >= -180 && latlng.lng <= 180 ? latlng : { lat: latlng.lat, lng: wrapLng(latlng.lng) };
}

// Copy coordinates старого клиента: SIGNED_DEGREES (toFixed(5)) от latlng.wrap()
export function pointCoordinates(point: LatLng): string {
    const { lat, lng } = wrapped(point);
    return `${lat.toFixed(5)} ${lng.toFixed(5)}`;
}

function trackBounds(tracks: readonly Pick<GeoData, 'segments' | 'points'>[]) {
    return boundsOf(tracks.flatMap((track) => [...track.segments.flat(), ...track.points]));
}

export function createTrackActions({
    store,
    sources,
    notify,
    location,
    writeClipboard = writeClipboardItem,
    restored = Promise.resolve(),
}: TrackActionsDeps) {
    const state = () => store.getState();

    async function load(data: Promise<GeoData[]>, fitView = false): Promise<Track[]> {
        state().changeLoadingTracks(1);
        try {
            const { tracks, messages } = prepareImport(await data);
            await restored;
            const added = state().addTracks(tracks);
            for (const message of messages) {
                notify(message, 'error');
            }
            const bounds = fitView ? trackBounds(added) : null;
            if (bounds) {
                state().requestBounds(bounds);
            }
            return added;
        } finally {
            state().changeLoadingTracks(-1);
        }
    }

    async function copyLink(tracks: readonly Track[], forceVisible = false) {
        if (tracks.length === 0) {
            notify('No tracks to copy', 'error');
            return;
        }
        const link = storeTracks(shareBody(tracks, forceVisible), sources).then((key) => shareLink(location(), key));
        let clipboard: Promise<void>;
        try {
            clipboard = writeClipboard(link);
        } catch (error) {
            clipboard = Promise.reject(error);
        }
        let text: string;
        try {
            text = await link;
        } catch (error) {
            clipboard.catch(() => {});
            const message = error instanceof ShareError ? error.message : String(error);
            notify(`Error making link: ${message}`, 'error');
            return;
        }
        try {
            await clipboard;
            notify('Link copied', 'success');
        } catch {
            // буфер не дался (нет разрешения, нет ClipboardItem) — ссылка окном
            state().setCopyFallback({ title: 'Link to tracks', text });
        }
    }

    function save(file: () => Parameters<typeof saveFile>[0]) {
        try {
            saveFile(file());
        } catch (error) {
            if (!(error instanceof EmptyTrackError)) {
                throw error;
            }
            notify(error.message, 'error');
        }
    }

    // копия трека с разметкой маршрута: номера опорных точек верны и для копии (линии не упрощаются)
    function copyOf(track: Track): GeoData {
        return geoData(track.name, {
            segments: track.segments.map((line) => line.map((p) => ({ ...p }))),
            points: track.points.map((p) => ({ ...p })),
            routes: track.segments.map((_, i) => settledRoute(track.routes?.[i])),
        });
    }

    // Точка трека правится по объекту, а не номеру: номер ищется в момент действия, пропавшая точка — ничего (design
    // add-web-line-tools, «Точки трека»)
    function updatePoint(trackId: string, point: Waypoint, change: (points: Waypoint[], index: number) => void) {
        const track = state().tracks.find((item) => item.id === trackId);
        const index = track?.points.indexOf(point) ?? -1;
        if (!track || index < 0) {
            return;
        }
        const points = track.points.slice();
        change(points, index);
        state().updateTrack(trackId, { points });
    }

    return {
        // Точки трека (спека tracks, «Добавление точек трека», «Меню точки трека»). Постановка — режим стора pointTool:
        // клик по карте зовёт addPoint, окно названия — pointDialog.
        startAddPoint(track: Track) {
            if (!track.visible) {
                state().updateTrack(track.id, { visible: true });
            }
            state().setPointTool({ kind: 'add', trackId: track.id });
        },
        startMovePoint: (trackId: string, point: Waypoint) => state().setPointTool({ kind: 'move', trackId, point }),
        stopPointTool: () => state().setPointTool(null),
        // окно названия точки (Rename в меню точки)
        startRenamePoint: (trackId: string, point: Waypoint) => state().setPointDialog({ trackId, point }),
        // новая точка с готовым номером; окно названия открывается сразу (createNewPoint старого клиента)
        addPoint(trackId: string, latlng: LatLng): Waypoint | null {
            const track = state().tracks.find((item) => item.id === trackId);
            if (!track) {
                return null;
            }
            const { lat, lng } = wrapped(latlng);
            const point: Waypoint = { lat, lng, name: nextPointName(track.points) };
            state().updateTrack(trackId, { points: [...track.points, point] });
            state().setPointDialog({ trackId, point });
            return point;
        },
        // пустое название допустимо, как у query старого клиента
        renamePoint: (trackId: string, point: Waypoint, name: string) =>
            updatePoint(trackId, point, (points, index) => {
                points[index] = { ...point, name };
            }),
        movePoint(trackId: string, point: Waypoint, latlng: LatLng) {
            updatePoint(trackId, point, (points, index) => {
                points[index] = { ...point, ...wrapped(latlng) };
            });
            state().setPointTool(null);
        },
        removePoint: (trackId: string, point: Waypoint) =>
            updatePoint(trackId, point, (points, index) => {
                points.splice(index, 1);
            }),
        async copyPointCoordinates(point: LatLng) {
            const text = pointCoordinates(point);
            try {
                await writeClipboard(Promise.resolve(text));
                notify('Coordinates copied', 'success');
            } catch {
                state().setCopyFallback({ title: 'Point coordinates', text });
            }
        },
        openFiles: (files: readonly File[]) =>
            load(
                Promise.all(
                    files.map(async (file) => parseGeoFile(file.name, new Uint8Array(await file.arrayBuffer()))),
                ).then((parsed) => parsed.flat()),
            ),
        openUrl: (url: string) => load(loadFromUrl(url.trim(), sources)),
        openTrackParams: (params: TrackParams, fitView: boolean) =>
            load(
                Promise.all(params.map(([key, values]) => loadTrackParam(key, values, sources))).then((loaded) =>
                    loaded.flat(),
                ),
                fitView,
            ),
        // новый трек из видимых: их отрезки и точки, название — первого видимого (старый клиент спрашивал название;
        // здесь его можно сменить «Rename»)
        newTrackFromVisible: () => {
            const visible = state().tracks.filter((track) => track.visible);
            if (visible.length === 0) {
                return;
            }
            const copies = visible.map(copyOf);
            state().addTracks([
                geoData(visible[0].name, {
                    segments: copies.flatMap((copy) => copy.segments),
                    points: copies.flatMap((copy) => copy.points),
                    routes: copies.flatMap((copy) => copy.routes ?? []),
                }),
            ]);
        },
        showTrack: (track: Track) => {
            const bounds = trackBounds([track]);
            if (bounds) {
                state().requestBounds(bounds);
            }
        },
        rename: (track: Track, name: string) => {
            if (name.trim()) {
                state().updateTrack(track.id, { name });
            }
        },
        duplicate: (track: Track) => state().addTracks([copyOf(track)]),
        // разметка разворачивается вместе с отрезками: проложенный отрезок остаётся проложенным (спека tracks,
        // «Развернуть проложенный трек»)
        reverse: (track: Track) =>
            state().updateTrack(track.id, {
                segments: track.segments.map((line) => [...line].reverse()),
                routes: track.segments.map((line, i) => reverseRoute(track.routes?.[i], line.length)),
            }),
        remove: (track: Track) => state().removeTracks([track.id]),
        removeAll: () => state().removeTracks(state().tracks.map((track) => track.id)),
        removeHidden: () =>
            state().removeTracks(
                state()
                    .tracks.filter((t) => !t.visible)
                    .map((t) => t.id),
            ),
        // Shift+клик по флажку — показать только этот трек (onTrackCheckboxClicked старого клиента)
        setVisible: (track: Track, visible: boolean, only = false) => {
            if (!only) {
                state().updateTrack(track.id, { visible });
                return;
            }
            for (const other of state().tracks) {
                state().updateTrack(other.id, { visible: other.id === track.id });
            }
        },
        setColor: (track: Track, color: number) => state().updateTrack(track.id, { color }),
        saveTrack: (track: Track, format: 'gpx' | 'kml') => save(() => exportTrack(track, format)),
        saveAll: () => save(() => exportZip(state().tracks)),
        copyTrackLink: (track: Track) => copyLink([track], true),
        copyAllLink: () => copyLink(state().tracks),
        copyVisibleLink: () => copyLink(state().tracks.filter((track) => track.visible)),
    };
}

export type TrackActions = ReturnType<typeof createTrackActions>;
