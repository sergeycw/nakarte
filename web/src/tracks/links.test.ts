import { describe, expect, test } from 'vitest';
import oldLinksText from '@/state/fixtures/old-links.txt?raw';
import { parseHash } from '@/state/hash';
import { isTrackParam, loadTrackParam } from './links';
import { encodeBase64Url, saveNktk } from './nktk';
import { fakeSources, TEST_STORAGE, viaTestProxy } from './test-sources';

const line = {
    name: 'Stored',
    segments: [
        [
            { lat: 41.7, lng: 44.8 },
            { lat: 41.71, lng: 44.81 },
        ],
    ],
    points: [],
};

function base64Json(value: unknown) {
    return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

describe('nktl', () => {
    test('Ссылка на хранилище: тело — строки nktk через /', async () => {
        const body = `${saveNktk(line)}/${saveNktk({ ...line, name: 'Second', color: 3 })}`;
        const { sources, requested } = fakeSources({ [`${TEST_STORAGE}/track/key1`]: { body } });
        const tracks = await loadTrackParam('nktl', ['key1'], sources);
        expect(tracks.map((track) => [track.name, track.color])).toEqual([
            ['Stored', 0],
            ['Second', 3],
        ]);
        expect(requested).toEqual([`${TEST_STORAGE}/track/key1`]);
    });

    test('Неизвестный ключ: 404 — ошибка загрузки', async () => {
        const { sources } = fakeSources({ [`${TEST_STORAGE}/track/nope`]: { status: 404, body: 'not found' } });
        expect(await loadTrackParam('nktl', ['nope'], sources)).toEqual([
            { name: 'Track from nakarte server', segments: [], points: [], error: 'NETWORK' },
        ]);
    });

    test('ключи из реальных ссылок разбираются в запросы к хранилищу клона', async () => {
        const keys = oldLinksText
            .split('\n')
            .flatMap((link) => (link.includes('nktl=') ? (parseHash(link).get('nktl') ?? []) : []));
        expect(keys.length).toBeGreaterThan(10);
        const { sources, requested } = fakeSources();
        await loadTrackParam('nktl', keys.slice(0, 2), sources);
        expect(requested).toEqual(keys.slice(0, 2).map((key) => `${TEST_STORAGE}/track/${key}`));
    });
});

describe('nktp', () => {
    test('Точка в адресе', async () => {
        expect(await loadTrackParam('nktp', ['41.7', '44.8', 'Tbilisi'], fakeSources().sources)).toEqual([
            { name: 'Tbilisi', segments: [], points: [{ name: 'Tbilisi', lat: 41.7, lng: 44.8 }] },
        ]);
    });

    test('без названия — Point, кодированное название раскодируется', async () => {
        const [noName] = await loadTrackParam('nktp', ['41.7', '44.8'], fakeSources().sources);
        expect(noName.name).toBe('Point');
        const [encoded] = await loadTrackParam('nktp', ['41.7', '44.8', '%D0%A2%D0%B1'], fakeSources().sources);
        expect(encoded.name).toBe('Тб');
    });

    test.each([[['91', '44']], [['41']], [['x', 'y']]])('испорченная точка %j — CORRUPT', async (values) => {
        const [result] = await loadTrackParam('nktp', values, fakeSources().sources);
        expect(result.error).toBe('CORRUPT');
    });
});

describe('nktj', () => {
    test('отрезки, точки, цвет, видимость и отметки', async () => {
        const value = base64Json([
            {
                n: 'Json track',
                t: [
                    [
                        [41.7, 44.8],
                        [41.71, 44.81],
                    ],
                ],
                p: [{ n: 'P', lt: 41.7, ln: 44.8 }],
                c: 4,
                v: 0,
                m: 1,
            },
        ]);
        expect(await loadTrackParam('nktj', [value], fakeSources().sources)).toEqual([
            {
                name: 'Json track',
                segments: [
                    [
                        { lat: 41.7, lng: 44.8 },
                        { lat: 41.71, lng: 44.81 },
                    ],
                ],
                points: [{ name: 'P', lat: 41.7, lng: 44.8 }],
                color: 4,
                hidden: true,
                measureTicksShown: true,
            },
        ]);
    });

    test('ссылка из реальной ссылки nktj идёт в импорт через прокси с названием из n', async () => {
        const link = oldLinksText.split('\n').find((item) => item.includes('nktj=')) ?? '';
        const value = parseHash(link).get('nktj')?.[0] ?? '';
        const url = 'https://tarwirdur.github.io/tracks/b41d906fa803bf47affc073e8d756163.gpx';
        const gpx = '<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="3" lon="4"/></trkseg></trk></gpx>';
        const { sources } = fakeSources({ [viaTestProxy(url)]: { body: gpx } });
        const [track] = await loadTrackParam('nktj', [value], sources);
        expect(track.error).toBeUndefined();
        expect(track.name).toBe('Таймыр 2021');
    });

    test.each([
        ['не base64', '!!!'],
        ['не JSON', base64Json('x').slice(0, 3)],
        ['пустой список', base64Json([])],
        ['элемент без данных', base64Json([{ n: 'x' }])],
        ['цвет вне палитры', base64Json([{ t: [[[1, 2]]], c: 9 }])],
        ['широта вне диапазона', base64Json([{ t: [[[91, 2]]] }])],
    ])('%s — CORRUPT', async (_, value) => {
        expect(await loadTrackParam('nktj', [value], fakeSources().sources)).toEqual([
            { name: 'Track in url', segments: [], points: [], error: 'CORRUPT' },
        ]);
    });
});

test('nktk: несколько строк и испорченная', async () => {
    const tracks = await loadTrackParam('nktk', [saveNktk(line), 'garbage'], fakeSources().sources);
    expect(tracks.map((track) => track.error)).toEqual([undefined, 'CORRUPT']);
});

test('nktu: закодированная ссылка идёт в импорт', async () => {
    const url = 'https://example.test/a.gpx';
    const gpx = '<gpx><wpt lat="1" lon="2"><name>W</name></wpt></gpx>';
    const { sources } = fakeSources({ [viaTestProxy(url)]: { body: gpx } });
    const [track] = await loadTrackParam('nktu', [encodeURIComponent(url)], sources);
    expect(track.points).toEqual([{ lat: 1, lng: 2, name: 'W' }]);
});

test('параметры треков', () => {
    expect(['nktk', 'nktl', 'nktu', 'nktp', 'nktj', 'm', 'l'].map(isTrackParam)).toEqual([
        true,
        true,
        true,
        true,
        true,
        false,
        false,
    ]);
});
