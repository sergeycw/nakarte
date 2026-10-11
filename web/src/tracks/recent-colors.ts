import { normalizeColor, parseHex } from './color';

// Недавние свои цвета палитры (design track-color-picker, «Недавние цвета»): удобство одного браузера, не данные трека.
// Хранилище может быть недоступно (приватное окно, запрет сайта) — тогда в строке палитры только готовые цвета.

const KEY = 'nakarte-web:recent-colors';
// три: в строке палитры из шести всегда остаются три первых готовых цвета (design palette-one-row)
export const RECENT_COLORS_LIMIT = 3;

export function readRecentColors(): string[] {
    try {
        const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
        if (!Array.isArray(value)) {
            return [];
        }
        const colors = value
            .map((item) => (typeof item === 'string' ? parseHex(item) : null))
            .filter((hex): hex is string => hex !== null && typeof normalizeColor(hex) === 'string');
        return [...new Set(colors)].slice(0, RECENT_COLORS_LIMIT);
    } catch {
        return [];
    }
}

// Свежий цвет первым, без повторов; цвета палитры сюда не попадают — они и так в строке палитры
export function rememberColor(hex: string): void {
    if (typeof normalizeColor(hex) !== 'string') {
        return;
    }
    try {
        const colors = [hex, ...readRecentColors().filter((color) => color !== hex)].slice(0, RECENT_COLORS_LIMIT);
        window.localStorage.setItem(KEY, JSON.stringify(colors));
    } catch {
        // без хранилища недавних нет
    }
}
