import { describe, expect, it } from 'vitest';
import { distance } from '@/tracks/geometry';
import {
    distanceAt,
    elevationAt,
    gridValues,
    indexAtDistance,
    nearestIndex,
    pointAt,
    profileStats,
    sampleSegments,
    samplingInterval,
    simplifyProfile,
    slopeAt,
} from './profile';

const P = (lat: number, lng: number) => ({ lat, lng });
// профиль с точками через 100 м на одном отрезке — для сводки важны только расстояния и отрезки
const even = (n: number, step = 100, starts = [0]) => ({
    distances: Float64Array.from({ length: n }, (_, i) => i * step),
    starts,
});

describe('samplingInterval', () => {
    // числа — calcSamplingInterval старого клиента на тех же длинах
    it('шаг 10–50 м и не больше 9 999 точек', () => {
        expect(samplingInterval(1000)).toBe(10);
        expect(samplingInterval(50_000)).toBe(25);
        expect(samplingInterval(1_000_000)).toBeCloseTo(1_000_000 / 9999, 9);
    });
});

describe('sampleSegments', () => {
    const line = [P(41.7, 44.78), P(41.709, 44.78)];
    const length = distance(line[0], line[1]);

    it('конец отрезка входит, даже если хвост короче шага', () => {
        const profile = sampleSegments([line], 100);
        expect(length).toBeGreaterThan(1000);
        expect(profile.points).toHaveLength(12);
        expect(profile.points.at(-1)).toEqual(line[1]);
        expect(profile.distances.at(-1)).toBeCloseTo(length, 6);
        expect(profile.distances[10]).toBeCloseTo(1000, 6);
        expect(profile.length).toBeCloseTo(length, 6);
    });

    it('точки на линии через шаг', () => {
        const profile = sampleSegments([line], 100);
        expect(profile.points[5].lng).toBe(44.78);
        expect(distance(line[0], profile.points[5])).toBeCloseTo(500, 3);
    });

    it('стык отрезков не добавляет расстояния', () => {
        const far = [P(41.75, 44.78), P(41.759, 44.78)];
        const profile = sampleSegments([line, far], 100);
        expect(profile.starts).toEqual([0, 12]);
        expect(profile.distances[12]).toBeCloseTo(profile.distances[11], 9);
        expect(profile.length).toBeCloseTo(2 * length, 3);
    });

    it('отрезок нулевой длины пропускается', () => {
        const profile = sampleSegments([[P(41, 44), P(41, 44)], line], 100);
        expect(profile.starts).toEqual([0]);
        expect(profile.points[0]).toEqual(line[0]);
    });

    it('начала и концы отрезков не выводят выборку за 10 000 точек (один запрос)', () => {
        // ≈ 600 км: шаг samplingInterval даёт 9 999 точек, а каждый отрезок добавляет ещё до двух
        for (const count of [2, 10, 100]) {
            const segments = Array.from({ length: count }, (_, k) => [
                P(40 + k * 0.01, 40),
                P(40 + k * 0.01 + 5.4 / count, 40),
            ]);
            expect(sampleSegments(segments).points.length).toBeLessThanOrEqual(10000);
        }
    });

    it('шаг по умолчанию — samplingInterval длины', () => {
        const profile = sampleSegments([line]);
        expect(profile.distances[1]).toBe(samplingInterval(length));
    });
});

describe('profileStats', () => {
    it('Подъём и спуск', () => {
        const stats = profileStats(even(3), [100, 200, 150]);
        expect(stats).toMatchObject({ ascent: 100, descent: 50, min: 100, max: 200, start: 100, end: 150 });
        expect(stats.distance).toBe(200);
    });

    it('Мелкие колебания', () => {
        const stats = profileStats(even(5), [100, 103, 100, 103, 100]);
        expect(stats.ascent).toBe(0);
        expect(stats.descent).toBe(0);
    });

    it('последняя точка с данными входит в набор (у старого срез её терял)', () => {
        expect(profileStats(even(4), [100, 100, 100, 150]).ascent).toBe(50);
    });

    it('Точки без данных: шкала без нуля, пометки, разрыв заполняется прямой', () => {
        const stats = profileStats(even(5), [null, 100, null, 200, null]);
        expect(stats).toMatchObject({ min: 100, max: 200, ascent: 100, missing: true, approxStart: true });
        expect(stats.approxEnd).toBe(true);
    });

    it('ни одной точки с данными', () => {
        expect(profileStats(even(3), [null, null, null])).toMatchObject({ noData: true, missing: true });
    });

    it('стык отрезков не считается подъёмом и не даёт уклона', () => {
        const stats = profileStats(even(4, 100, [0, 2]), [100, 100, 300, 300]);
        expect(stats).toMatchObject({ ascent: 0, descent: 0, start: 100, end: 300, ascentAngle: null });
    });

    it('уклоны — средний и наибольший по расстоянию', () => {
        const stats = profileStats(even(4), [0, 100, 110, 50]);
        expect(stats.ascentAngle).toEqual({ avg: 29, max: 45 });
        expect(stats.descentAngle).toEqual({ avg: 31, max: 31 });
    });

    it('сводка участка', () => {
        const stats = profileStats(even(5), [100, 200, 300, 200, 100], 1, 3);
        expect(stats).toMatchObject({ distance: 200, start: 200, end: 200, ascent: 100, descent: 100, max: 300 });
    });
});

describe('simplifyProfile', () => {
    it('оставляет изломы больше допуска, по расстоянию', () => {
        expect(simplifyProfile([0, 10, 20, 1000], [0, 100, 0, 0], 5)).toEqual([0, 1, 2, 3]);
        expect(simplifyProfile([0, 10, 20], [0, 4, 0], 5)).toEqual([0, 2]);
    });
});

describe('gridValues', () => {
    it('3–5 круглых значений вокруг диапазона, как calcGridValues старого', () => {
        expect(gridValues(100, 200)).toEqual([100, 150, 200]);
        expect(gridValues(1230, 2080)).toEqual([1000, 1500, 2000, 2500]);
        expect(gridValues(100, 100)).toEqual([100, 101, 102]);
    });
});

describe('курсор', () => {
    const points = [P(0, 0), P(0, 1), P(0, 2)];
    const distances = Float64Array.from([0, 100, 150]);

    it('точка и расстояние по дробному номеру', () => {
        expect(pointAt(points, 1.5)).toEqual(P(0, 1.5));
        expect(pointAt(points, 5)).toEqual(P(0, 2));
        expect(distanceAt(distances, 1.5)).toBe(125);
    });

    it('номер по расстоянию', () => {
        expect(indexAtDistance(distances, 50)).toBe(0.5);
        expect(indexAtDistance(distances, 125)).toBe(1.5);
        expect(indexAtDistance(distances, 1000)).toBe(2);
    });

    it('высота и уклон у курсора', () => {
        expect(elevationAt([100, null, 200], 0.8)).toBe(100);
        expect(elevationAt([100, null, 200], 1.2)).toBe(200);
        expect(elevationAt([100, null, 200], 1)).toBeNull();
        const profile = { distances: Float64Array.from([0, 100, 200]), starts: [0] };
        expect(slopeAt(profile, [0, 100, 100], 0.5)).toBe(45);
        expect(slopeAt(profile, [0, null, 100], 0.5)).toBeNull();
        expect(slopeAt({ ...profile, starts: [0, 1] }, [0, 100, 100], 0.5)).toBeNull();
    });

    it('ближайшее место на линии на экране, без звена через стык', () => {
        const screen = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 200, y: 100 },
        ];
        expect(nearestIndex(screen, [0], { x: 50, y: 3 }, 10)).toBe(0.5);
        expect(nearestIndex(screen, [0], { x: 50, y: 30 }, 10)).toBeNull();
        expect(nearestIndex(screen, [0, 1], { x: 50, y: 3 }, 10)).toBeNull();
        expect(nearestIndex(screen, [0], { x: 201, y: 101 }, 10)).toBe(2);
    });
});
