import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { AppState, AppStore } from './store';

export const AppStoreContext = createContext<AppStore | null>(null);

export function useAppStore<T>(selector: (state: AppState) => T): T {
    const store = useContext(AppStoreContext);
    if (!store) {
        throw new Error('useAppStore outside AppStoreContext');
    }
    return useStore(store, selector);
}

// сам стор — для обработчиков событий, которым нужно текущее состояние без подписки компонента
export function useAppStoreApi(): AppStore {
    const store = useContext(AppStoreContext);
    if (!store) {
        throw new Error('useAppStoreApi outside AppStoreContext');
    }
    return store;
}
