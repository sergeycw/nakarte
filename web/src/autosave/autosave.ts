import type { AppStore } from '@/state/store';
import { prepareImport } from '@/tracks/import-result';
import type { GeoData } from '@/tracks/model';
import { fromSaved, type SavedSet, toSaved } from './saved';

// Автосохранение рабочего набора (design add-web-autosave): треки вкладки с разметкой маршрута пишутся в хранилище на
// каждое изменение tracks в сторе и восстанавливаются при старте. Без таймера: запись уходит сразу, а пока она в полёте,
// изменения копятся пометкой «грязно» и уходят одной записью последнего состояния после неё — серия правок даёт не
// больше одной записи на коммит, а одиночная правка не ждёт окна debounce, в которое укладывается перезагрузка.
// Запись на pagehide при перезагрузке может не дойти (AGENTS.md), поэтому flush — только подстраховка.

export interface AutosaveStorage {
    // запись как есть или undefined, если её нет; ошибка — хранилище недоступно
    load(): Promise<unknown>;
    save(record: SavedSet): Promise<void>;
    // откуда взять список, если своей записи ещё нет: последняя сессия старого клиента (design switch-to-web-app,
    // «Сессия старого клиента: последняя, один раз»). Подхваченный список сразу пишется своей записью, поэтому второй раз
    // источник не спрашивается.
    legacy?(): Promise<GeoData[]>;
}

export interface Autosave {
    // восстановление закончилось, не удалось или не уложилось в RESTORE_TIMEOUT_MS: после него можно добавлять треки
    // из адреса и файлов. Никогда не отклоняется.
    restored: Promise<void>;
    // записать несохранённое сейчас, не дожидаясь текущей записи (pagehide, вкладка ушла в фон)
    flush(): void;
    stop(): void;
}

// Сколько ждать чтения, прежде чем отпустить треки из адреса и файлов: IndexedDB бывает, что не отвечает ни успехом, ни
// ошибкой, и тогда ссылка не открылась бы никогда. Восстановленные треки и после этого встанут в начало списка.
export const RESTORE_TIMEOUT_MS = 3000;

// Стор восстанавливается один раз: Fast Refresh в dev перезапускает эффекты App при живом сторе, и второе чтение
// задвоило бы список. Strict Mode сюда не попадает — его первый экземпляр останавливается до конца чтения.
const restoredStores = new WeakSet<AppStore>();

export function startAutosave(
    store: AppStore,
    storage: AutosaveStorage,
    restoreTimeoutMs = RESTORE_TIMEOUT_MS,
): Autosave {
    // запись включается только после восстановления: иначе пустой стор первой записью затёр бы сохранённое
    let enabled = false;
    let stopped = false;
    let dirty = false;
    let inFlight = false;
    let warned = false;

    function warn(error: unknown) {
        if (!warned) {
            warned = true;
            console.warn('nakarte: tracks are not saved between reloads', error);
        }
    }

    function write() {
        dirty = false;
        return storage.save(toSaved(store.getState().tracks)).catch(warn);
    }

    function next() {
        if (stopped || inFlight || !dirty) {
            return;
        }
        inFlight = true;
        write().finally(() => {
            inFlight = false;
            next();
        });
    }

    const unsubscribe = store.subscribe((state, prev) => {
        if (enabled && state.tracks !== prev.tracks) {
            dirty = true;
            next();
        }
    });

    // imported — треки не из своей записи (сессия старого клиента): их надо сразу записать своей записью
    function restore(read: () => GeoData[] | null, imported = false) {
        if (stopped) {
            return;
        }
        // до конца чтения список успели изменить (New track) — после восстановления его надо записать
        let changed = store.getState().tracks !== tracksAtStart;
        try {
            const saved = read();
            if (saved?.length) {
                store.getState().addTracks(saved, true);
                changed ||= imported;
            }
        } catch (error) {
            // испорченная запись не должна ни ронять приложение, ни выключать сохранение: следующая запись её заменит
            warn(error);
        }
        restoredStores.add(store);
        enabled = true;
        dirty = changed;
        next();
    }

    async function load() {
        const value = await storage.load();
        if (value !== undefined || !storage.legacy) {
            restore(() => fromSaved(value));
            return;
        }
        // своей записи нет: список старого клиента проходит тот же путь, что ссылка (упрощение с опорными точками)
        const legacy = await storage.legacy().catch((error: unknown) => {
            warn(error);
            return [];
        });
        restore(() => prepareImport(legacy).tracks, true);
    }

    const tracksAtStart = store.getState().tracks;
    let read: Promise<void>;
    if (restoredStores.has(store)) {
        enabled = true;
        read = Promise.resolve();
    } else {
        read = load().catch(warn);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const restored = Promise.race([
        read,
        new Promise<void>((resolve) => {
            timer = setTimeout(resolve, restoreTimeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));

    return {
        restored,
        flush() {
            // транзакции readwrite над одним хранилищем IndexedDB выполняет по порядку создания, поэтому вторая запись
            // параллельно текущей не обгонит её
            if (enabled && !stopped && dirty) {
                void write();
            }
        },
        stop() {
            stopped = true;
            unsubscribe();
        },
    };
}
