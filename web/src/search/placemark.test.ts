import { describe, expect, it } from 'vitest';
import { formatPlacemark, parsePlacemark } from './placemark';

describe('метка в адресе r=', () => {
    it('Ссылка с меткой: координаты и название через encodeURIComponent', () => {
        expect(parsePlacemark(['41.693040', '44.779477', 'Mtatsminda%20Park'])).toEqual({
            lat: 41.69304,
            lng: 44.779477,
            title: 'Mtatsminda Park',
        });
    });

    it('запись — формат старого клиента, «/» в названии кодируется', () => {
        expect(formatPlacemark({ lat: 41.69304014285044, lng: 44.779476642611193, title: 'A/B парк' })).toEqual([
            '41.693040',
            '44.779477',
            'A%2FB%20%D0%BF%D0%B0%D1%80%D0%BA',
        ]);
    });

    it('без названия — метка с пустым названием', () => {
        expect(parsePlacemark(['10', '20'])).toEqual({ lat: 10, lng: 20, title: '' });
    });

    it.each([[[]], [['91', '10']], [['10', '181']], [['x', '1']], [['10']]])(
        'неверные координаты %j — без метки',
        (values) => {
            expect(parsePlacemark(values)).toBeNull();
        },
    );

    it('испорченный % в названии — название как есть', () => {
        expect(parsePlacemark(['1', '2', '%E0'])).toEqual({ lat: 1, lng: 2, title: '%E0' });
    });
});
