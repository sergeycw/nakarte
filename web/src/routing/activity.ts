import { getActivity } from './brouter';

// Выбранная активность в localStorage (спека routing, «Выбор активности сохраняется»). Свой ключ: origin общий со старым
// клиентом. Пока своего ключа нет, берётся выбор старого клиента (trackListRoutingActivity) — как настройки слоёв
// (layers/settings.ts): старый ключ только читается. Неизвестный идентификатор — прокладка выключена.

const STORAGE_KEY = 'nakarte-web:routing-activity';
const LEGACY_STORAGE_KEY = 'trackListRoutingActivity';

function read(storage: Storage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

export function loadActivity(storage: Storage | null): string | null {
    if (!storage) {
        return null;
    }
    const own = read(storage, STORAGE_KEY);
    return getActivity(own ?? read(storage, LEGACY_STORAGE_KEY))?.id ?? null;
}

// «Off» удаляет свой ключ; старый ключ не трогается — его пишет старый клиент. Без своего ключа старый выбор снова
// подхватился бы после «Off», поэтому «Off» пишется пустой строкой, а не удалением, если старый ключ есть.
export function saveActivity(storage: Storage | null, id: string | null): void {
    try {
        if (id) {
            storage?.setItem(STORAGE_KEY, id);
        } else if (storage && read(storage, LEGACY_STORAGE_KEY) !== null) {
            storage.setItem(STORAGE_KEY, '');
        } else {
            storage?.removeItem(STORAGE_KEY);
        }
    } catch {
        // хранилище недоступно или переполнено: выбор живёт до перезагрузки
    }
}
