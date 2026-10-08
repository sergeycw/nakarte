import { describe, expect, test } from 'vitest';
import oldLinksText from '@/state/fixtures/old-links.txt?raw';
import { parseHash } from '@/state/hash';
import reference from './fixtures/nktk-old.json';
import type { GeoData } from './model';
import { ARC_UNIT, parseNktk, parseNktkSequence, parseTrackUrlData, saveNktk } from './nktk';

// Эталон — строки, записанные кодировщиками старого клиента, и их разбор старым parseNktkFragment
// (fixtures/nktk-old.json): v4 — saveNktk, v3 и v2 — saveToString из истории апстрима (7534e57^, f339a82^),
// v1 и v0 (track://) — строка v2 без точек с версией 1 и без версии.

interface OldGeoData {
    name: string;
    error?: string[];
    tracks?: { lat: number; lng: number }[][];
    points?: { lat: number; lng: number; name: string }[];
    color: number;
    measureTicksShown: number | boolean;
    trackHidden: boolean;
}

function fromOld(old: OldGeoData): GeoData {
    return {
        name: old.name,
        segments: old.tracks ?? [],
        points: old.points ?? [],
        color: old.color,
        measureTicksShown: Boolean(old.measureTicksShown),
        hidden: old.trackHidden,
        ...(old.error ? { error: 'CORRUPT' } : {}),
    };
}

describe('строки старого клиента', () => {
    test.each(reference.cases)('версия $version: $nktk', ({ version, nktk, decoded }) => {
        const parsed = version === 0 ? parseTrackUrlData(nktk) : parseNktk(nktk);
        expect(parsed).toEqual((decoded as OldGeoData[]).map(fromOld));
    });

    test('последовательность через /', () => {
        expect(parseNktkSequence(reference.sequence.nktk)).toEqual(
            (reference.sequence.decoded as OldGeoData[]).map(fromOld),
        );
    });

    test('Трек в адресе: nktk из реальной ссылки', () => {
        const link = oldLinksText.split('\n').find((line) => line.includes('nktk='));
        const [track] = parseNktk(parseHash(link ?? '').get('nktk')?.[0] ?? '');
        expect(track.error).toBeUndefined();
        expect(track.name).not.toBe('');
    });
});

describe('запись версии 4', () => {
    const track = {
        name: 'Тест трек',
        segments: [
            [
                { lat: 41.69, lng: 44.8 },
                { lat: -41.72, lng: -144.83 },
            ],
        ],
        points: [{ lat: 41.69, lng: 44.79, name: 'Перевал' }],
        color: 2,
        measureTicksShown: true,
        hidden: true,
    };

    test('совпадает со старым saveNktk байт в байт', () => {
        const [oldV4] = reference.cases;
        expect(oldV4.version).toBe(4);
        const decoded = fromOld((oldV4.decoded as OldGeoData[])[0]);
        expect(saveNktk(decoded)).toBe(oldV4.nktk);
    });

    test('запись → чтение — тот же трек на сетке ARC_UNIT', () => {
        const [parsed] = parseNktk(saveNktk(track));
        const grid = (value: number) => Math.round(value * ARC_UNIT) / ARC_UNIT;
        expect(parsed).toEqual({
            ...track,
            segments: track.segments.map((line) => line.map((p) => ({ lat: grid(p.lat), lng: grid(p.lng) }))),
            points: track.points.map((p) => ({ ...p, lat: grid(p.lat), lng: grid(p.lng) })),
        });
    });

    test('пустой трек — как старый', () => {
        expect(saveNktk({ name: '', segments: [], points: [] })).toBe(reference.cases[5].nktk);
    });
});

describe('испорченные строки', () => {
    test.each(['', '!!!', 'Zg', 'RA', 'Q1HQotC1'])('%s — CORRUPT без исключения', (text) => {
        const parsed = parseNktk(text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].error).toBe('CORRUPT');
    });
});
