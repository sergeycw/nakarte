import type { ProfileData } from '@/state/store';
import { distanceAt, type Elevation, elevationAt, type SlopeSection, sectionAt, slopeSections } from './profile';

// Тексты профиля: метры целыми, километры с двумя знаками, как у старого клиента (updatePropsDisplay, setCursorPosition)

export const meters = (value: number) => `${Math.round(value)} m`;
export const kilometers = (value: number) => `${(value / 1000).toFixed(2)} km`;

// Участки крутизны профиля — раз на массив высот: курсор зовёт cursorInfo на каждое движение мыши, а массив values
// меняется только при перестроении профиля (вместе с samples, controller.ts)
const sectionsCache = new WeakMap<readonly Elevation[], SlopeSection[]>();

export function profileSections(data: ProfileData): SlopeSection[] {
    const values = data.values ?? [];
    let sections = sectionsCache.get(values);
    if (!sections) {
        sections = slopeSections(data.samples, values);
        sectionsCache.set(values, sections);
    }
    return sections;
}

export interface CursorInfo {
    elevation: string;
    distance: string;
    // уклон участка раскраски со стрелкой: «↑ 12%», «↓ 4%», «0%»; «-» — вне участков (design slope-profile, «Курсор»)
    slope: string;
}

export function cursorInfo(data: ProfileData, index: number): CursorInfo {
    const { samples } = data;
    const values = data.values ?? [];
    const height = elevationAt(values, index);
    const section = sectionAt(profileSections(data), index);
    let slopeText = '-';
    if (section) {
        // округление модуля, как в slopeClass: Math.round(-2.5) = -2, а ступень −2.5 % — 3–6
        const percent = Math.round(Math.abs(section.grade));
        const arrow = percent === 0 ? '' : section.grade > 0 ? '↑ ' : '↓ ';
        slopeText = `${arrow}${percent}%`;
    }
    return {
        elevation: height === null ? '-' : meters(height),
        distance: kilometers(distanceAt(samples.distances, index) - samples.distances[0]),
        slope: slopeText,
    };
}
