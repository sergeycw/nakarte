import type { AutosaveStorage } from './autosave';
import type { SavedSet } from './saved';

// Хранилище автосохранения в IndexedDB (design add-web-autosave): своя база на общем со старым клиентом origin — его
// база sessions здесь не открывается: её один раз читает legacy-session.ts и не меняет (design switch-to-web-app).
// Одна запись под ключом tracks в хранилище объектов autosave.

export const AUTOSAVE_DB = 'nakarte-web';
const STORE = 'autosave';
const KEY = 'tracks';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        // transaction.error заполняется только при abort, а он и следует за ошибкой запроса
        transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
    });
}

// factory — параметр для тестов; по умолчанию глобальный indexedDB (обращение к нему само может бросить SecurityError,
// когда хранилище сайта запрещено, — это ошибка load, а не падение приложения)
export function indexedDbStorage(name = AUTOSAVE_DB, factory?: () => IDBFactory): AutosaveStorage {
    let opened: Promise<IDBDatabase> | null = null;

    function open(): Promise<IDBDatabase> {
        opened ??= new Promise<IDBDatabase>((resolve, reject) => {
            const request = (factory ? factory() : indexedDB).open(name, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE);
            request.onsuccess = () => {
                const db = request.result;
                // другая вкладка с новой версией базы: закрыться, чтобы не держать её обновление
                db.onversionchange = () => db.close();
                resolve(db);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error(`IndexedDB ${name} is blocked by another tab`));
        });
        return opened;
    }

    return {
        async load() {
            const db = await open();
            return requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY));
        },
        async save(record: SavedSet) {
            const db = await open();
            const transaction = db.transaction(STORE, 'readwrite');
            transaction.objectStore(STORE).put(record, KEY);
            await transactionDone(transaction);
        },
    };
}
