import { describe, expect, test } from 'vitest';
import type { Track } from './model';
import { parseNktk } from './nktk';
import { ShareError, shareBody, shareLink, storeTracks, trackKey } from './share';
import { fakeSources, TEST_STORAGE } from './test-sources';

// Пара «тело POST — ключ nktl», снятая со старого клиента (workers/tracks/test/fixtures/client-track.json)
const CLIENT_BODY = 'RAoCEAESIAoJTmV3IHRyYWNrEhMKB4Ka7QGxAXYSCIjW_gGQA5AD';
const CLIENT_KEY = 'eULz6eCr_il5HksAhitPnA';

function track(fields: Partial<Track> = {}): Track {
    return { id: '1', name: 'T', segments: [], points: [], color: 0, visible: true, ...fields };
}

describe('тело и ключ', () => {
    test('ключ — как у старого клиента и Worker', () => {
        expect(trackKey(CLIENT_BODY)).toBe(CLIENT_KEY);
    });

    test('тело трека старого клиента собирается заново байт в байт', () => {
        const [parsed] = parseNktk(CLIENT_BODY);
        expect(shareBody([track({ ...parsed, color: parsed.color ?? 0, visible: !parsed.hidden })])).toBe(CLIENT_BODY);
    });

    test('видимость: скрытый трек пишется скрытым, forceVisible — видимым', () => {
        const hidden = track({ visible: false });
        expect(parseNktk(shareBody([hidden]))[0].hidden).toBe(true);
        expect(parseNktk(shareBody([hidden], true))[0].hidden).toBe(false);
    });

    test('несколько треков — через /', () => {
        expect(shareBody([track({ name: 'a' }), track({ name: 'b' })]).split('/')).toHaveLength(2);
    });
});

describe('адрес ссылки', () => {
    const location = { origin: 'https://nakarte-routing.pages.dev', pathname: '/next/' };

    test('без q, r и параметров треков, nktl в конце', () => {
        expect(shareLink({ ...location, hash: '#m=10/41.7/44.8&q=tbilisi&l=O/Hs&r=41/44/x&nktk=abc&p=1' }, 'KEY')).toBe(
            'https://nakarte-routing.pages.dev/next/#m=10/41.7/44.8&l=O/Hs&p=1&nktl=KEY',
        );
    });
});

describe('запись в хранилище', () => {
    const url = `${TEST_STORAGE}/track/${CLIENT_KEY}`;

    test('200 — ключ', async () => {
        const { sources, requested } = fakeSources({ [url]: { body: '' } });
        await expect(storeTracks(CLIENT_BODY, sources)).resolves.toBe(CLIENT_KEY);
        expect(requested).toEqual([url]);
    });

    test('413 — track is too big', async () => {
        const { sources } = fakeSources({ [url]: { status: 413, body: '' } });
        await expect(storeTracks(CLIENT_BODY, sources)).rejects.toThrow(new ShareError('track is too big'));
    });

    test('сеть упала', async () => {
        await expect(storeTracks(CLIENT_BODY, fakeSources().sources)).rejects.toThrow(ShareError);
    });

    test('другая ошибка — код ответа', async () => {
        const { sources } = fakeSources({ [url]: { status: 429, body: '' } });
        await expect(storeTracks(CLIENT_BODY, sources)).rejects.toThrow('server responded with 429');
    });
});
