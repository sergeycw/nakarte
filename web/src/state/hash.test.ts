import { describe, expect, test } from 'vitest';
import oldLinksText from './fixtures/old-links.txt?raw';
import { formatHash, formatView, parseHash, parseView, withParam } from './hash';

const OLD_LINKS = oldLinksText.split('\n').filter((line) => line.startsWith('http'));

function hashOf(link: string) {
    return link.slice(link.indexOf('#') + 1);
}

describe('реальные ссылки старого клиента', () => {
    test('набор не пустой', () => {
        expect(OLD_LINKS.length).toBeGreaterThan(40);
    });

    test.each(OLD_LINKS)('разбор и сборка возвращают тот же адрес: %s', (link) => {
        expect(formatHash(parseHash(link))).toBe(hashOf(link));
    });

    test('вид из m= каждой ссылки с годным m=', () => {
        const views = OLD_LINKS.map((link) => parseView(parseHash(link).get('m'))).filter(Boolean);
        expect(views.length).toBeGreaterThan(40);
        for (const view of views) {
            expect(view?.zoom).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('parseHash', () => {
    test('пары, значения через /, ключ без значения', () => {
        const params = parseHash('#m=13/42.68490/47.07008&l=O/K&autoprofile');
        expect([...params]).toEqual([
            ['m', ['13', '42.68490', '47.07008']],
            ['l', ['O', 'K']],
            ['autoprofile', []],
        ]);
    });

    test('= внутри значения остаётся значением (base64 своих слоёв)', () => {
        expect(parseHash('#l=-csabc==').get('l')).toEqual(['-csabc==']);
    });

    test('пустой адрес и пустые пары', () => {
        expect(parseHash('').size).toBe(0);
        expect(parseHash('#').size).toBe(0);
        expect([...parseHash('#a=1&&b')]).toEqual([
            ['a', ['1']],
            ['b', []],
        ]);
    });
});

describe('withParam', () => {
    test('существующий ключ остаётся на месте, новый — в конец, null удаляет', () => {
        const params = parseHash('#m=10/41/44&nktl=key&q=x');
        expect(formatHash(withParam(params, 'm', ['11', '41.00000', '44.00000']))).toBe(
            'm=11/41.00000/44.00000&nktl=key&q=x',
        );
        expect(formatHash(withParam(params, 'l', ['O']))).toBe('m=10/41/44&nktl=key&q=x&l=O');
        expect(formatHash(withParam(params, 'q', null))).toBe('m=10/41/44&nktl=key');
    });
});

describe('вид в адресе', () => {
    test('зум MapLibre на 1 меньше зума старого клиента', () => {
        expect(parseView(['13', '42.68490', '47.07008'])).toEqual({ lat: 42.6849, lng: 47.07008, zoom: 12 });
        expect(parseView(['0', '10', '20'])).toEqual({ lat: 10, lng: 20, zoom: 0 });
    });

    test.each([
        ['m=99/49.44893/52.5547', ['99', '49.44893', '52.5547']],
        ['неполный m=11/49.44893/', ['11', '49.44893', '']],
        ['широта за 90', ['5', '91', '10']],
        ['два значения', ['5', '10']],
        ['не число', ['x', '10', '20']],
    ])('неверный вид: %s', (_, values) => {
        expect(parseView(values)).toBeNull();
    });

    test('нет m=', () => {
        expect(parseView(undefined)).toBeNull();
    });

    test('сборка: зум +1 до двух знаков, координаты — 5 знаков', () => {
        expect(formatView({ lat: 42.684901, lng: 47.070081, zoom: 12 })).toEqual(['13', '42.68490', '47.07008']);
        expect(formatView({ lat: 1, lng: 2, zoom: 7.4567 })).toEqual(['8.46', '1.00000', '2.00000']);
    });

    test('дробный зум из нового приложения читается обратно', () => {
        expect(parseView(formatView({ lat: 1, lng: 2, zoom: 7.5 }))).toEqual({ lat: 1, lng: 2, zoom: 7.5 });
    });
});
