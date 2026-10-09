import type { AppState, AppStore, ProfileTarget } from '@/state/store';
import type { LatLng, Track } from '@/tracks/model';
import { type ElevationSource, errorReason, fetchElevations } from './api';
import { sampleSegments } from './profile';

// Профиль высот без React (design add-web-elevation-profile, «Профиль следует за треком»): по цели из стора (трек или
// его отрезок) строит выборку, запрашивает высоты и пишет результат в стор. Профиль следует за треком: изменение
// track.segments (стор меняет массив при любой правке геометрии) перестраивает его, когда изменений нет delay мс и в
// линиях профиля нет ожидающих отрезков; удаление трека — закрывает, профиль отрезка закрывается и при смене числа
// отрезков (номер мог уйти на другой отрезок).

type Notify = (title: string, type?: 'error' | 'success') => void;

export interface ElevationProfileDeps {
    store: AppStore;
    source: ElevationSource;
    notify: Notify;
    // пауза перед перестроением после изменения трека, мс
    delay?: number;
}

function linesOf(track: Track, target: ProfileTarget): LatLng[][] | null {
    if (target.segment === null) {
        return track.segments;
    }
    const line = track.segments[target.segment];
    return line ? [line] : null;
}

function hasPending(track: Track, target: ProfileTarget): boolean {
    const indexes = target.segment === null ? track.segments.map((_, i) => i) : [target.segment];
    return indexes.some((i) => track.routes?.[i]?.legs.some((leg) => leg.state === 'pending'));
}

export function createElevationProfile({ store, source, notify, delay = 1000 }: ElevationProfileDeps) {
    const state = () => store.getState();
    // по каким отрезкам построен текущий профиль: его изменение — повод перестроить
    let builtFrom: { segments: readonly (readonly LatLng[])[]; count: number } | null = null;
    let request: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function cancel() {
        request?.abort();
        request = null;
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function close() {
        cancel();
        builtFrom = null;
        state().setProfile(null);
    }

    // Строит профиль цели по треку из стора. false — строить не из чего (трека нет, линий нет или их длина 0).
    function build(target: ProfileTarget): boolean {
        const track = state().tracks.find((item) => item.id === target.trackId);
        const lines = track && linesOf(track, target);
        if (!track || !lines) {
            return false;
        }
        const samples = sampleSegments(lines);
        if (samples.points.length < 2) {
            return false;
        }
        cancel();
        builtFrom = { segments: track.segments, count: track.segments.length };
        const previous = state().profileData;
        state().setProfileData({
            samples: previous?.values ? previous.samples : samples,
            values: previous?.values ?? null,
            updating: true,
            error: null,
        });
        const controller = new AbortController();
        request = controller;
        fetchElevations(samples.points, source, controller.signal).then(
            (values) => {
                if (request !== controller) {
                    return;
                }
                request = null;
                // новые точки — прежние курсор и выделение указывают не туда
                store.setState({ profileCursor: null, profileSelection: null });
                state().setProfileData({ samples, values, updating: false, error: null });
            },
            (error) => {
                if (request !== controller) {
                    return;
                }
                request = null;
                state().setProfileData({
                    samples: previous?.values ? previous.samples : samples,
                    values: previous?.values ?? null,
                    updating: false,
                    error: errorReason(error),
                });
            },
        );
        return true;
    }

    function rebuildLater() {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            const target = state().profile;
            const track = target && state().tracks.find((item) => item.id === target.trackId);
            // ожидающий отрезок — прямая-заглушка: ждать ответа роутера, он снова поменяет трек
            if (!target || !track || hasPending(track, target)) {
                return;
            }
            if (!build(target)) {
                close();
            }
        }, delay);
    }

    function onChange(next: AppState, prev: AppState) {
        const target = next.profile;
        if (!target || next.tracks === prev.tracks || !builtFrom) {
            return;
        }
        const track = next.tracks.find((item) => item.id === target.trackId);
        if (!track) {
            close();
            return;
        }
        if (track.segments === builtFrom.segments) {
            return;
        }
        if (target.segment !== null && track.segments.length !== builtFrom.count) {
            close();
            return;
        }
        builtFrom = { segments: track.segments, count: track.segments.length };
        rebuildLater();
    }

    return {
        // Профиль трека (segment null) или отрезка; пустой — сообщение Track is empty, как у старого клиента
        open(trackId: string, segment: number | null = null) {
            cancel();
            const target = { trackId, segment };
            state().setProfile(target);
            if (!build(target)) {
                close();
                notify('Track is empty', 'error');
            }
        },
        close,
        retry() {
            const target = state().profile;
            if (target && !build(target)) {
                close();
            }
        },
        // подписка на стор — в эффекте App, а не при создании: Strict Mode создаёт объект дважды
        start() {
            const unsubscribe = store.subscribe(onChange);
            return () => {
                unsubscribe();
                cancel();
            };
        },
    };
}

export type ElevationProfileController = ReturnType<typeof createElevationProfile>;
