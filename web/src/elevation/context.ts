import { createContext, useContext } from 'react';
import type { ElevationProfileController } from './controller';

// Профиль высот для компонентов: App создаёт контроллер один раз со своим fetch
export const ElevationProfileContext = createContext<ElevationProfileController | null>(null);

export function useElevationProfile(): ElevationProfileController {
    const profile = useContext(ElevationProfileContext);
    if (!profile) {
        throw new Error('useElevationProfile outside ElevationProfileContext');
    }
    return profile;
}
