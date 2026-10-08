import { expect, test } from 'vitest';
import { prepareImport } from './import-result';
import { geoData } from './model';

const line = [
    { lat: 1, lng: 2 },
    { lat: 1, lng: 2.5 },
    { lat: 1, lng: 3 },
];

test('данные без ошибки — трек, линии упрощены', () => {
    const { tracks, messages } = prepareImport([geoData('a.gpx', { segments: [line] })]);
    expect(messages).toEqual([]);
    expect(tracks[0].segments).toEqual([[line[0], line[2]]]);
});

test('Неизвестный формат', () => {
    expect(prepareImport([geoData('x.bin', { error: 'UNSUPPORTED' })])).toEqual({
        tracks: [],
        messages: ['File "x.bin" has unsupported format or is badly corrupt, no data could be loaded'],
    });
});

test('Испорченный трек: данные открываются, сообщение о неполноте', () => {
    const { tracks, messages } = prepareImport([geoData('c.gpx', { segments: [line], error: 'CORRUPT' })]);
    expect(tracks).toHaveLength(1);
    expect(messages).toEqual(['File "c.gpx" is corrupt, loaded data can be invalid or incomplete']);
});

test('Пустой GPX', () => {
    expect(prepareImport([geoData('e.gpx')]).messages).toEqual([
        'No data could be loaded from file "e.gpx". File is empty or contains only unsupported data.',
    ]);
});

test('готовый текст сервиса с {name}, пустой список, allowEmpty', () => {
    expect(prepareImport([geoData('T 1', { error: '{name} is private' })]).messages).toEqual([
        'T 1 is private, no data could be loaded',
    ]);
    expect(prepareImport([]).messages).toEqual(['No tracks loaded']);
    expect(prepareImport([geoData('New track')], true)).toEqual({ tracks: [geoData('New track')], messages: [] });
});
