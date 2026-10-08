import { useContext, useEffect, useState } from 'react';
import { AppStoreContext } from '@/state/context';
import { hotkeyOf, isListed } from './settings';

// Хоткеи слоёв — только при точном указателе (мышь), как areHotkeysEnabled старого клиента
// (!L.Browser.touch || !L.Browser.mobile): на телефоне клавиатуры нет, а подписи клавиш занимают место.
export function useHotkeysEnabled(): boolean {
    const [enabled] = useState(() => window.matchMedia('(pointer: fine)').matches);
    return enabled;
}

// Клавиша → хоткей: A–Z и 0–9 по event.code, чтобы раскладка (например, русская) не меняла клавишу
export function hotkeyFromEvent(event: KeyboardEvent): string | null {
    const match = /^(?:Key|Digit)(.)$/u.exec(event.code);
    return match ? match[1] : null;
}

function isTextInput(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// keydown, а не keyup: на macOS, пока зажат Cmd, браузер не присылает keyup других клавиш (AGENTS.md,
// «Подвохи редактора»); старый клиент ловил пару keydown/keyup. Модификаторы и автоповтор пропускаются.
export function useLayerHotkeys(enabled: boolean): void {
    const store = useContext(AppStoreContext);
    useEffect(() => {
        if (!enabled || !store) {
            return;
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
                return;
            }
            if (isTextInput(event.target)) {
                return;
            }
            const key = hotkeyFromEvent(event);
            if (!key || !store) {
                return;
            }
            const state = store.getState();
            const layer = [...state.layers.values()]
                .sort((a, b) => a.order - b.order)
                .find((item) => isListed(item, state.settings) && hotkeyOf(item, state.settings) === key);
            if (!layer) {
                return;
            }
            if (layer.isOverlay) {
                state.toggleOverlay(layer.code);
            } else {
                state.selectBase(layer.code);
            }
        }
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled, store]);
}
