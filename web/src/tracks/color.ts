import { TRACK_COLORS, type TrackColor } from './model';

// Свой цвет трека (design track-color-picker): разбор hex, HSV пикера, ближайший цвет палитры для старых читателей
// ссылки. Без карты и React.

export interface Hsv {
    // оттенок 0–360, насыщенность и яркость 0–100
    h: number;
    s: number;
    v: number;
}

// '#rgb', '#rrggbb', с решёткой или без, любой регистр → '#rrggbb' строчными; иначе null
export function parseHex(text: string): string | null {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
    if (!match) {
        return null;
    }
    const digits = match[1].toLowerCase();
    if (digits.length === 6) {
        return `#${digits}`;
    }
    return `#${[...digits].map((digit) => digit + digit).join('')}`;
}

// Свой цвет, совпавший с цветом палитры, хранится номером: у одного цвета одна запись
export function normalizeColor(hex: string): TrackColor {
    const index = (TRACK_COLORS as readonly string[]).indexOf(hex);
    return index >= 0 ? index : hex;
}

// Цвет из ссылки, файла или записи: номер в пределах палитры или hex; иначе null
export function parseTrackColor(value: unknown): TrackColor | null {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0 && value < TRACK_COLORS.length ? value : null;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const hex = parseHex(value);
    return hex ? normalizeColor(hex) : null;
}

export function hexToRgb(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
}

export function rgbToHex(rgb: number): string {
    return `#${(rgb & 0xffffff).toString(16).padStart(6, '0')}`;
}

function channels(hex: string): [number, number, number] {
    const rgb = hexToRgb(hex);
    return [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
}

// Номер ближайшего цвета палитры по евклидову расстоянию в RGB: его пишет поле color строки nktk рядом со своим цветом
export function nearestPaletteIndex(hex: string): number {
    const [r, g, b] = channels(hex);
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    TRACK_COLORS.forEach((color, index) => {
        const [pr, pg, pb] = channels(color);
        const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (d < bestDistance) {
            best = index;
            bestDistance = d;
        }
    });
    return best;
}

export function hexToHsv(hex: string): Hsv {
    const [r, g, b] = channels(hex).map((channel) => channel / 255);
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    let h = 0;
    if (delta > 0) {
        if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }
    }
    return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

export function hsvToHex({ h, s, v }: Hsv): string {
    const value = v / 100;
    const chroma = value * (s / 100);
    const sector = (((h % 360) + 360) % 360) / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));
    const [r, g, b] = [
        [chroma, x, 0],
        [x, chroma, 0],
        [0, chroma, x],
        [0, x, chroma],
        [x, 0, chroma],
        [chroma, 0, x],
    ][Math.floor(sector) % 6];
    const m = value - chroma;
    const byte = (channel: number) => Math.round((channel + m) * 255);
    return rgbToHex((byte(r) << 16) | (byte(g) << 8) | byte(b));
}
