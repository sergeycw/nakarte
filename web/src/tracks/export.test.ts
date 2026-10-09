import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, test } from 'vitest';
import { EmptyTrackError, exportGpxWithElevations, exportTrack, exportZip, fileBaseName } from './export';
import type { TrackData } from './model';
import { parseGeoFile } from './parsers';

const track: TrackData = {
    name: 'Перевал <A & B>.gpx',
    segments: [
        [
            { lat: 41.690001, lng: 44.8 },
            { lat: 41.695, lng: 44.805 },
        ],
        [
            { lat: 41.7, lng: 44.81 },
            { lat: 41.71, lng: 44.82 },
        ],
    ],
    points: [{ lat: 41.69, lng: 44.79, name: 'Хижина "Альфа" & Co' }],
};

function reparse(content: string | Uint8Array, filename: string) {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    return parseGeoFile(filename, bytes);
}

describe('экспорт → импорт', () => {
    test.each(['gpx', 'kml'] as const)('Сохранить в %s', (format) => {
        const file = exportTrack(track, format);
        expect(file.filename).toBe(`Перевал <A & B>.${format}`);
        const [parsed] = reparse(file.content, file.filename);
        expect(parsed.error).toBeUndefined();
        expect(parsed.segments).toEqual(track.segments);
        expect(parsed.points).toEqual(track.points);
    });

    test.each(['gpx', 'kml'] as const)('Экспорт в файл (%s): только геометрия, без разметки маршрута', (format) => {
        const routed: TrackData = {
            ...track,
            routes: [{ waypoints: [0, 1], legs: [{ state: 'routed', activity: 'hiking' }] }, null],
        };
        expect(exportTrack(routed, format).content).toBe(exportTrack(track, format).content);
        expect(reparse(exportTrack(routed, format).content, `t.${format}`)[0].routes).toBeUndefined();
    });

    test('координаты — шесть знаков', () => {
        const file = exportTrack(
            {
                name: 't',
                segments: [
                    [
                        { lat: 1.23456789, lng: 2 },
                        { lat: 1, lng: 2 },
                    ],
                ],
                points: [],
            },
            'gpx',
        );
        expect(file.content).toContain('lat="1.234568" lon="2.000000"');
    });

    test('пустой трек — Track is empty, nothing to save', () => {
        expect(() => exportTrack({ name: 't', segments: [], points: [] }, 'gpx')).toThrow(EmptyTrackError);
        expect(() => exportTrack({ name: 't', segments: [], points: [] }, 'gpx')).toThrow(
            'Track is empty, nothing to save',
        );
    });

    test('отрезок через 180° делится у меридиана', () => {
        const file = exportTrack(
            {
                name: 't',
                segments: [
                    [
                        { lat: 0, lng: 179 },
                        { lat: 0, lng: 181 },
                    ],
                ],
                points: [],
            },
            'gpx',
        );
        expect(reparse(file.content, 'x.gpx')[0].segments).toHaveLength(2);
    });
});

// Спека track-files, «GPX с высотами»: высота — функция координат, точка с широтой 41.71 — без данных
describe('GPX с высотами', () => {
    const heights = async (points: readonly { lat: number; lng: number }[]) =>
        points.map((p) => (p.lat === 41.71 ? null : Math.round(p.lat * 1000) / 10));

    test('Сохранить с высотами', async () => {
        const file = await exportGpxWithElevations(track, heights);
        const gpx = file.content as string;
        expect(file.filename).toBe('Перевал <A & B>.gpx');
        expect(gpx).toContain('<trkpt lat="41.690001" lon="44.800000"><ele>4169.0</ele><time>');
        expect(gpx).toContain('<trkpt lat="41.700000" lon="44.810000"><ele>4170.0</ele><time>');
        // порядок схемы GPX 1.1: ele раньше name
        expect(gpx).toMatch(/<wpt lat="41.690000" lon="44.790000">\n\t\t<ele>4169.0<\/ele>\n\t\t<name>/u);
        // координаты и состав — как у обычного GPX
        const [parsed] = reparse(gpx, file.filename);
        expect(parsed.segments).toEqual(track.segments);
        expect(parsed.points).toEqual(track.points);
    });

    test('Точка без данных', async () => {
        const gpx = (await exportGpxWithElevations(track, heights)).content as string;
        expect(gpx).toContain('<trkpt lat="41.710000" lon="44.820000"><time>');
        expect(gpx.match(/<ele>/gu)).toHaveLength(4);
    });

    test('высоты идут по порядку точек после деления у 180°', async () => {
        const requested: { lat: number; lng: number }[] = [];
        const file = await exportGpxWithElevations(
            {
                name: 't',
                segments: [
                    [
                        { lat: 0, lng: 179 },
                        { lat: 1, lng: 181 },
                    ],
                ],
                points: [],
            },
            async (points) => {
                requested.push(...points);
                return points.map((_, i) => i);
            },
        );
        expect(requested).toHaveLength(4);
        expect((file.content as string).match(/<ele>[\d.]+<\/ele>/gu)).toEqual([
            '<ele>0.0</ele>',
            '<ele>1.0</ele>',
            '<ele>2.0</ele>',
            '<ele>3.0</ele>',
        ]);
    });

    test('пустой трек — без запроса', async () => {
        let called = false;
        await expect(
            exportGpxWithElevations({ name: 't', segments: [], points: [] }, async () => {
                called = true;
                return [];
            }),
        ).rejects.toThrow(EmptyTrackError);
        expect(called).toBe(false);
    });

    test('обычный GPX — без <ele>', () => {
        expect(exportTrack(track, 'gpx').content).not.toContain('<ele>');
    });
});

describe('имена файлов', () => {
    test.each([
        ['track.gpx', 'track'],
        ['track.gpx.xml', 'track'],
        ['.hidden', '_hidden'],
        ['a.b', 'a.b'],
    ])('%s → %s', (name, base) => {
        expect(fileBaseName(name)).toBe(base);
    });
});

test('Все треки в ZIP', () => {
    const zip = exportZip([track, track, { name: 'a/b?', segments: [], points: [] }], new Date(2026, 0, 5, 7, 8));
    expect(zip.filename).toBe('nakarte_tracks_05.01.2026_07.08.zip');
    const files = unzipSync(zip.content as Uint8Array);
    // символы, недопустимые в именах файлов, — `_`
    expect(Object.keys(files)).toEqual(['Перевал _A & B_.gpx', 'Перевал _A & B_(1).gpx', 'a_b_.gpx']);
    expect(strFromU8(files['Перевал _A & B_(1).gpx'])).toContain('<name>Хижина &quot;Альфа&quot; &amp; Co</name>');
    // архив читается своим же импортом: имена с флагом UTF-8
    expect(reparse(zip.content, zip.filename).map((data) => data.name)).toEqual([
        'Перевал _A & B_.gpx',
        'Перевал _A & B_(1).gpx',
        'a_b_.gpx',
    ]);
});
