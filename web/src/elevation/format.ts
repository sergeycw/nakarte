import type { ProfileData } from '@/state/store';
import { distanceAt, elevationAt, slopeAt } from './profile';

// Тексты профиля: метры целыми, километры с двумя знаками, как у старого клиента (updatePropsDisplay, setCursorPosition)

export const meters = (value: number) => `${Math.round(value)} m`;
export const kilometers = (value: number) => `${(value / 1000).toFixed(2)} km`;

export interface CursorInfo {
    elevation: string;
    distance: string;
    // уклон шага со стрелкой: «↑ 5°», «↓ 3°», «0°»; «-» — нет данных
    slope: string;
}

export function cursorInfo(data: ProfileData, index: number): CursorInfo {
    const { samples } = data;
    const values = data.values ?? [];
    const height = elevationAt(values, index);
    const slope = slopeAt(samples, values, index);
    let slopeText = '-';
    if (slope !== null) {
        const arrow = slope > 0 ? '↑ ' : slope < 0 ? '↓ ' : '';
        slopeText = `${arrow}${Math.abs(slope)}°`;
    }
    return {
        elevation: height === null ? '-' : meters(height),
        distance: kilometers(distanceAt(samples.distances, index) - samples.distances[0]),
        slope: slopeText,
    };
}
