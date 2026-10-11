import { describe, expect, test } from 'vitest';
import { hexToHsv, hsvToHex, nearestPaletteIndex, normalizeColor, parseHex, parseTrackColor } from './color';
import { TRACK_COLORS, trackColor } from './model';

describe('свой цвет трека', () => {
    test.each([
        ['#14B8A6', '#14b8a6'],
        ['14b8a6', '#14b8a6'],
        ['#abc', '#aabbcc'],
        [' #000000 ', '#000000'],
        ['#12zz', null],
        ['#1234', null],
        ['teal', null],
    ])('разбор hex %s', (text, hex) => {
        expect(parseHex(text)).toBe(hex);
    });

    test.each(['#14b8a6', '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080', ...TRACK_COLORS])(
        'hex → HSV → hex: %s',
        (hex) => {
            expect(hsvToHex(hexToHsv(hex))).toBe(hex);
        },
    );

    test('HSV краёв', () => {
        expect(hsvToHex({ h: 0, s: 100, v: 100 })).toBe('#ff0000');
        expect(hsvToHex({ h: 360, s: 100, v: 100 })).toBe('#ff0000');
        expect(hsvToHex({ h: 120, s: 100, v: 100 })).toBe('#00ff00');
        expect(hsvToHex({ h: 200, s: 0, v: 0 })).toBe('#000000');
        expect(hexToHsv('#00ff00')).toEqual({ h: 120, s: 100, v: 100 });
    });

    test('ближайший цвет палитры', () => {
        expect(nearestPaletteIndex('#14b8a6')).toBe(2);
        expect(nearestPaletteIndex('#ff0000')).toBe(3);
        TRACK_COLORS.forEach((color, index) => {
            expect(nearestPaletteIndex(color)).toBe(index);
        });
    });

    test('цвет палитры хранится номером', () => {
        expect(normalizeColor('#ef4444')).toBe(3);
        expect(normalizeColor('#14b8a6')).toBe('#14b8a6');
        expect(parseTrackColor('#EF4444')).toBe(3);
    });

    test.each([
        [2, 2],
        [5, 5],
        [6, null],
        [-1, null],
        [1.5, null],
        ['#14B8A6', '#14b8a6'],
        ['teal', null],
        [null, null],
        [undefined, null],
    ])('цвет из ссылки или записи %s', (value, color) => {
        expect(parseTrackColor(value)).toBe(color);
    });

    test('краска', () => {
        expect(trackColor(3)).toBe(TRACK_COLORS[3]);
        expect(trackColor('#14b8a6')).toBe('#14b8a6');
        expect(trackColor(undefined)).toBe(TRACK_COLORS[0]);
    });
});
