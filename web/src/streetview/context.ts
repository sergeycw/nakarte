import { createContext, useContext } from 'react';
import type { StreetView } from './controller';

// Режим Street View для компонентов: App создаёт его один раз со своим API (Google или заглушка тестов)
export const StreetViewContext = createContext<StreetView | null>(null);

export function useStreetView(): StreetView {
    const streetView = useContext(StreetViewContext);
    if (!streetView) {
        throw new Error('useStreetView outside StreetViewContext');
    }
    return streetView;
}
