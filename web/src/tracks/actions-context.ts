import { createContext, useContext } from 'react';
import type { TrackActions } from './actions';

// Действия списка треков для компонентов: App создаёт их один раз со своими сетью и уведомлениями
export const TrackActionsContext = createContext<TrackActions | null>(null);

export function useTrackActions(): TrackActions {
    const actions = useContext(TrackActionsContext);
    if (!actions) {
        throw new Error('useTrackActions outside TrackActionsContext');
    }
    return actions;
}
