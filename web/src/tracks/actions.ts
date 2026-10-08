import type { AppStore } from '@/state/store';
import type { TrackParams } from '@/state/sync';
import { EmptyTrackError, exportTrack, exportZip, saveFile } from './export';
import { boundsOf } from './geometry';
import { prepareImport } from './import-result';
import { loadFromUrl } from './import-url';
import { loadTrackParam } from './links';
import { type GeoData, geoData, type Track } from './model';
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
    // запись в буфер обмена; получает промис ссылки сразу, в обработчике клика (design add-web-tracks, «Ссылка»)
    writeClipboard?: (text: Promise<string>) => Promise<void>;
}

// ClipboardItem с промисом: Safari сохраняет жест пользователя на время запроса к хранилищу, Chromium ждёт промис
export function writeClipboardItem(text: Promise<string>): Promise<void> {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
    return navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
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
}: TrackActionsDeps) {
    const state = () => store.getState();

    async function load(data: Promise<GeoData[]>, fitView = false): Promise<Track[]> {
        state().changeLoadingTracks(1);
        try {
            const { tracks, messages } = prepareImport(await data);
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
            state().setSharedLink(text);
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

    function copyOf(track: Track): GeoData {
        return geoData(track.name, {
            segments: track.segments.map((line) => line.map((p) => ({ ...p }))),
            points: track.points.map((p) => ({ ...p })),
        });
    }

    return {
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
        newTrack: (name: string) => state().addTracks(prepareImport([geoData(name || 'New track')], true).tracks),
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
        reverse: (track: Track) =>
            state().updateTrack(track.id, { segments: track.segments.map((line) => [...line].reverse()) }),
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
