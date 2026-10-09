import type { AutosaveStorage } from '@/autosave/autosave';

// Хранилище автосохранения в памяти для browser-тестов: запись — structured clone, как у IndexedDB
export function memoryAutosave(): AutosaveStorage {
    let record: unknown;
    return {
        load: async () => (record === undefined ? undefined : structuredClone(record)),
        save: async (next) => {
            record = structuredClone(next);
        },
    };
}
