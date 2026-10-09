import { createContext, useContext } from 'react';
import type { RouteEditing } from './editing';

// Связь редактора со стором для компонентов: App создаёт её один раз со своими роутером и уведомлениями
export const RouteEditingContext = createContext<RouteEditing | null>(null);

export function useRouteEditing(): RouteEditing {
    const editing = useContext(RouteEditingContext);
    if (!editing) {
        throw new Error('useRouteEditing outside RouteEditingContext');
    }
    return editing;
}
