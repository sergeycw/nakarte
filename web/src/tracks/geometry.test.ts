import { describe, expect, test } from 'vitest';
import {
    boundsOf,
    distance,
    formatLength,
    normalizeLine,
    SIMPLIFY_TOLERANCE,
    simplify,
    splitAt180,
    tracksLength,
    unwrapLine,
    wrapLng,
} from './geometry';

describe('длина', () => {
    test('градус по экватору — как CRS.Earth Leaflet (R = 6 371 000 м)', () => {
        expect(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo((6371000 * Math.PI) / 180, 3);
    });

    test('длина трека — сумма отрезков', () => {
        const segments = [
            [
                { lat: 0, lng: 0 },
                { lat: 0, lng: 1 },
            ],
            [
                { lat: 0, lng: 1 },
                { lat: 0, lng: 2 },
            ],
        ];
        expect(tracksLength(segments)).toBeCloseTo(2 * distance(segments[0][0], segments[0][1]), 3);
    });

    test.each([
        [0, '0.00 km'],
        [9999, '10.00 km'],
        [12345, '12.3 km'],
        [123456, '123 km'],
    ])('формат %d м — %s', (meters, text) => {
        expect(formatLength(meters)).toBe(text);
    });
});

describe('упрощение', () => {
    test('точки ближе допуска к прямой выпадают, концы остаются', () => {
        const line = [
            { lat: 0, lng: 0 },
            { lat: SIMPLIFY_TOLERANCE / 2, lng: 0.5 },
            { lat: 0, lng: 1 },
        ];
        expect(simplify(line)).toEqual([line[0], line[2]]);
    });

    test('излом больше допуска остаётся', () => {
        const line = [
            { lat: 0, lng: 0 },
            { lat: 0.01, lng: 0.5 },
            { lat: 0, lng: 1 },
        ];
        expect(simplify(line)).toEqual(line);
    });

    test('сто тысяч точек на прямой — без переполнения стека', () => {
        const line = Array.from({ length: 100_000 }, (_, i) => ({ lat: 0, lng: i / 1000 }));
        expect(simplify(line)).toEqual([line[0], line.at(-1)]);
    });

    test('одна точка повторяется', () => {
        expect(normalizeLine([{ lat: 1, lng: 2 }])).toEqual([
            { lat: 1, lng: 2 },
            { lat: 1, lng: 2 },
        ]);
    });
});

describe('меридиан 180°', () => {
    test('развёртка: линия через 180° непрерывна', () => {
        expect(
            unwrapLine([
                { lat: 0, lng: 179 },
                { lat: 0, lng: -179 },
                { lat: 0, lng: -178 },
            ]).map((p) => p.lng),
        ).toEqual([179, 181, 182]);
    });

    test('экспорт делит отрезок через 180° на два у меридиана', () => {
        const lines = splitAt180([
            { lat: 0, lng: 179 },
            { lat: 2, lng: 181 },
        ]);
        expect(lines).toHaveLength(2);
        expect(lines[0][0]).toEqual({ lat: 0, lng: 179 });
        expect(lines[0][1].lng).toBeCloseTo(179.999999, 6);
        expect(lines[0][1].lat).toBeCloseTo(1, 5);
        expect(lines[1][0].lng).toBeCloseTo(-179.999999, 6);
        expect(lines[1][1]).toEqual({ lat: 2, lng: -179 });
    });

    test('линия без пересечения — как есть', () => {
        expect(
            splitAt180([
                { lat: 0, lng: 10 },
                { lat: 1, lng: 11 },
            ]),
        ).toEqual([
            [
                { lat: 0, lng: 10 },
                { lat: 1, lng: 11 },
            ],
        ]);
    });

    test('wrap как у Leaflet', () => {
        expect([wrapLng(180), wrapLng(181), wrapLng(-181), wrapLng(540)]).toEqual([180, -179, 179, -180]);
    });
});

test('границы точек', () => {
    expect(
        boundsOf([
            { lat: 1, lng: 2 },
            { lat: -1, lng: 5 },
        ]),
    ).toEqual({ west: 2, south: -1, east: 5, north: 1 });
    expect(boundsOf([])).toBeNull();
});
