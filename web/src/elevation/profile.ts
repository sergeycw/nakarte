import { distance } from '@/tracks/geometry';
import type { LatLng } from '@/tracks/model';

// Профиль высот без карты и React (design add-web-elevation-profile, «Выборка», «Сводка и шкала»). Справочник —
// src/lib/leaflet.control.elevation-profile/index.js старого клиента; отличия от него — исправления, перечисленные в
// Context design.

// calcSamplingInterval старого клиента без изменений: 2 000 точек на обычный трек, шаг 10–50 м, но не больше 9 999
// точек — один запрос к API высот (лимит 10 000 точек, спека elevation-api). Начала и концы отрезков добавляют точки
// сверх шага — их учитывает sampleSegments.
export function samplingInterval(length: number): number {
    const targetPoints = 2000;
    const maxPoints = 9999;
    let interval = Math.min(Math.max(length / targetPoints, 10), 50);
    if (length / interval > maxPoints) {
        interval = length / maxPoints;
    }
    return interval;
}

export interface ProfileSamples {
    points: LatLng[];
    // расстояние каждой точки от начала профиля, м: по длине линии, стык отрезков расстояния не добавляет
    distances: Float64Array;
    // номера точек, с которых начинается каждый отрезок (starts[0] = 0): звено через стык — не звено линии
    starts: number[];
    length: number;
}

// Точки через равный шаг от начала каждого отрезка, конец отрезка — всегда (у pathRegularSamples старого хвост короче
// шага терялся). Отрезки нулевой длины пропускаются. Точки между узлами — линейно по широте и долготе, как у старого:
// шаг 10–100 м, искажение проекции на нём ничтожно.
export function sampleSegments(segments: readonly (readonly LatLng[])[], step?: number): ProfileSamples {
    const lengths = segments.map(segmentLength);
    const total = lengths.reduce((sum, value) => sum + value, 0);
    const interval = step ?? fittingInterval(total, lengths.filter((length) => length > 0).length);
    const points: LatLng[] = [];
    const distances: number[] = [];
    const starts: number[] = [];
    let offset = 0;
    segments.forEach((line, k) => {
        if (lengths[k] === 0) {
            return;
        }
        starts.push(points.length);
        points.push({ lat: line[0].lat, lng: line[0].lng });
        distances.push(offset);
        let lastSample = 0;
        let walked = 0;
        for (let i = 1; i < line.length; i++) {
            const a = line[i - 1];
            const b = line[i];
            const legLength = distance(a, b);
            const next = walked + legLength;
            while (lastSample + interval <= next) {
                lastSample += interval;
                const q = (lastSample - walked) / legLength;
                points.push({ lat: a.lat + (b.lat - a.lat) * q, lng: a.lng + (b.lng - a.lng) * q });
                distances.push(offset + lastSample);
            }
            walked = next;
        }
        // конец отрезка, если последняя точка выборки не легла в него (допуск — сантиметр: накопленная ошибка сумм)
        if (walked - lastSample > 0.01) {
            const end = line[line.length - 1];
            points.push({ lat: end.lat, lng: end.lng });
            distances.push(offset + walked);
        }
        offset += walked;
    });
    return { points, distances: Float64Array.from(distances), starts, length: offset };
}

// Шаг, при котором выборка влезает в один запрос: у отрезка не больше длина / шаг + 2 точек (начало и конец сверх
// шага), так что при многих отрезках шаг растёт. Отрезков больше 4 999 — в запрос не влезть, его делит api.ts.
const MAX_SAMPLES = 10000;

function fittingInterval(total: number, segments: number): number {
    const interval = samplingInterval(total);
    const budget = MAX_SAMPLES - 2 * segments;
    return budget > 0 && total / interval > budget ? total / budget : interval;
}

function segmentLength(line: readonly LatLng[]): number {
    let length = 0;
    for (let i = 1; i < line.length; i++) {
        length += distance(line[i - 1], line[i]);
    }
    return length;
}

export type Elevation = number | null;

export interface Inclination {
    // градусы, округлены как gradientToAngle старого
    avg: number;
    max: number;
}

export interface ProfileStats {
    distance: number;
    // ни одной точки с данными
    noData: boolean;
    min: number;
    max: number;
    start: number;
    end: number;
    ascent: number;
    descent: number;
    ascentAngle: Inclination | null;
    descentAngle: Inclination | null;
    // больше 2 % точек без данных: в начале, в конце, всего (пометка «~» и «Some elevation data missing»)
    approxStart: boolean;
    approxEnd: boolean;
    missing: boolean;
}

const APPROX_SHARE = 0.02;
// допуск упрощения высот перед подсчётом набора и сброса (filterTolerance старого клиента)
export const ASCENT_TOLERANCE = 5;

const toAngle = (gradient: number) => Math.round((Math.atan(gradient) * 180) / Math.PI);

// Сводка профиля на точках from..to (включительно) — calcProfileStats старого клиента с исправлениями: точки без
// данных выбрасываются до упрощения (у старого null оставался и считался нулём), последняя точка с данными входит в
// набор, упрощение и уклоны — по расстоянию, стык отрезков — не шаг.
export function profileStats(
    profile: Pick<ProfileSamples, 'distances' | 'starts'>,
    values: readonly Elevation[],
    from = 0,
    to = values.length - 1,
): ProfileStats {
    const { distances, starts } = profile;
    const count = to - from + 1;
    const stats: ProfileStats = {
        distance: count > 0 ? distances[to] - distances[from] : 0,
        noData: true,
        min: 0,
        max: 0,
        start: 0,
        end: 0,
        ascent: 0,
        descent: 0,
        ascentAngle: null,
        descentAngle: null,
        approxStart: false,
        approxEnd: false,
        missing: false,
    };
    let first = -1;
    let last = -1;
    let known = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = from; i <= to; i++) {
        const value = values[i];
        if (value === null || value === undefined) {
            continue;
        }
        known++;
        if (first < 0) {
            first = i;
        }
        last = i;
        min = Math.min(min, value);
        max = Math.max(max, value);
    }
    if (known === 0) {
        stats.missing = count > 0;
        return stats;
    }
    stats.noData = false;
    stats.min = min;
    stats.max = max;
    stats.start = values[first] as number;
    stats.end = values[last] as number;
    stats.approxStart = (first - from) / count > APPROX_SHARE;
    stats.approxEnd = (to - last) / count > APPROX_SHARE;
    stats.missing = 1 - known / count > APPROX_SHARE;

    // по отрезкам: точки с данными, их упрощение и уклоны шагов
    let ascentRise = 0;
    let ascentRun = 0;
    let ascentMax = Number.NEGATIVE_INFINITY;
    let descentDrop = 0;
    let descentRun = 0;
    let descentMax = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < starts.length; k++) {
        const begin = Math.max(starts[k], from);
        const end = Math.min((starts[k + 1] ?? values.length) - 1, to);
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = begin; i <= end; i++) {
            const value = values[i];
            if (value !== null && value !== undefined) {
                xs.push(distances[i]);
                ys.push(value);
            }
        }
        for (let j = 1; j < xs.length; j++) {
            const run = xs[j] - xs[j - 1];
            const rise = ys[j] - ys[j - 1];
            if (run <= 0) {
                continue;
            }
            if (rise > 0) {
                ascentRise += rise;
                ascentRun += run;
                ascentMax = Math.max(ascentMax, rise / run);
            } else if (rise < 0) {
                descentDrop -= rise;
                descentRun += run;
                descentMax = Math.max(descentMax, -rise / run);
            }
        }
        const kept = simplifyProfile(xs, ys, ASCENT_TOLERANCE);
        for (let j = 1; j < kept.length; j++) {
            const delta = ys[kept[j]] - ys[kept[j - 1]];
            if (delta > 0) {
                stats.ascent += delta;
            } else {
                stats.descent -= delta;
            }
        }
    }
    if (ascentRun > 0) {
        stats.ascentAngle = { avg: toAngle(ascentRise / ascentRun), max: toAngle(ascentMax) };
    }
    if (descentRun > 0) {
        stats.descentAngle = { avg: toAngle(descentDrop / descentRun), max: toAngle(descentMax) };
    }
    return stats;
}

// filterElevations старого клиента — Дуглас — Пекер по вертикальной ошибке от прямой между опорными точками, но по
// расстоянию, а не по номеру точки. Возвращает номера оставленных точек по возрастанию. Стеком, а не рекурсией.
export function simplifyProfile(xs: readonly number[], ys: readonly number[], tolerance: number): number[] {
    const n = xs.length;
    if (n < 3) {
        return Array.from({ length: n }, (_, i) => i);
    }
    const keep = new Uint8Array(n);
    keep[0] = 1;
    keep[n - 1] = 1;
    const stack: [number, number][] = [[0, n - 1]];
    while (stack.length) {
        const [a, b] = stack.pop() as [number, number];
        const span = xs[b] - xs[a];
        let worst = -1;
        let worstError = tolerance;
        for (let i = a + 1; i < b; i++) {
            const linear = span > 0 ? ys[a] + ((ys[b] - ys[a]) * (xs[i] - xs[a])) / span : ys[a];
            const error = Math.abs(ys[i] - linear);
            if (error > worstError) {
                worstError = error;
                worst = i;
            }
        }
        if (worst >= 0) {
            keep[worst] = 1;
            stack.push([a, worst], [worst, b]);
        }
    }
    const kept: number[] = [];
    keep.forEach((flag, i) => {
        if (flag) {
            kept.push(i);
        }
    });
    return kept;
}

// calcGridValues старого клиента: 3–5 линий шкалы с круглым шагом, накрывающие min..max
export function gridValues(min: number, max: number): number[] {
    const counts = [3, 4, 5];
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    let first = 0;
    let count = counts[counts.length - 1];
    let step = steps[steps.length - 1];
    search: for (const candidate of steps) {
        for (const n of counts) {
            const lo = Math.floor(min / candidate);
            const hi = Math.ceil(max / candidate);
            if (hi - lo < n) {
                first = lo;
                count = n;
                step = candidate;
                break search;
            }
        }
    }
    return Array.from({ length: count }, (_, i) => (first + i) * step);
}

// Точка на линии профиля по дробному номеру: между соседними точками выборки — линейно (setCursorPosition старого)
export function pointAt(points: readonly LatLng[], index: number): LatLng {
    if (index <= 0) {
        return points[0];
    }
    if (index >= points.length - 1) {
        return points[points.length - 1];
    }
    const i = Math.floor(index);
    const q = index - i;
    const a = points[i];
    const b = points[i + 1];
    return { lat: a.lat + (b.lat - a.lat) * q, lng: a.lng + (b.lng - a.lng) * q };
}

export function distanceAt(distances: Float64Array, index: number): number {
    if (index <= 0) {
        return distances[0];
    }
    if (index >= distances.length - 1) {
        return distances[distances.length - 1];
    }
    const i = Math.floor(index);
    return distances[i] + (distances[i + 1] - distances[i]) * (index - i);
}

// Дробный номер точки по расстоянию от начала (курсор графика стоит по расстоянию, а точки выборки — неравномерно на
// концах отрезков). На стыке отрезков расстояние двух точек одно — берётся вторая, начало следующего отрезка.
export function indexAtDistance(distances: Float64Array, at: number): number {
    const n = distances.length;
    if (n === 0 || at <= distances[0]) {
        return 0;
    }
    if (at >= distances[n - 1]) {
        return n - 1;
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (distances[mid] <= at) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    const span = distances[hi] - distances[lo];
    return span > 0 ? lo + (at - distances[lo]) / span : lo;
}

// Высота у курсора: в точке выборки, иначе соседняя с данными (как у старого — ближайшая, затем floor, затем ceil)
export function elevationAt(values: readonly Elevation[], index: number): Elevation {
    const near = values[Math.round(index)];
    if (near !== null && near !== undefined) {
        return near;
    }
    return values[Math.floor(index)] ?? values[Math.ceil(index)] ?? null;
}

// Раскраска профиля по крутизне (design slope-profile, «Уклон по участкам», «Ступени в процентах по модулю»). Шаг
// выборки (10–50 м) мельче ячейки данных высот 3″ (≈ 90 м): уклон соседних точек — шум интерполяции, поэтому уклон
// считается по участкам не короче sectionLength.

// пороги ступеней, % по модулю: < 3, 3–6, 6–10, 10–15, 15–25, ≥ 25
export const SLOPE_STEPS = [3, 6, 10, 15, 25];

// цвета ступеней: последовательная шкала, светлота OKLCH строго убывает (94.5 → 39.6 %), порядок читается и без
// различения оттенков. Классы целиком строками — их находит сканер Tailwind.
export const SLOPE_CLASSES = [
    { fill: 'fill-yellow-200', swatch: 'bg-yellow-200' },
    { fill: 'fill-amber-300', swatch: 'bg-amber-300' },
    { fill: 'fill-orange-400', swatch: 'bg-orange-400' },
    { fill: 'fill-orange-600', swatch: 'bg-orange-600' },
    { fill: 'fill-red-700', swatch: 'bg-red-700' },
    { fill: 'fill-red-900', swatch: 'bg-red-900' },
];

// участок не короче ячейки данных и не мельче 1/200 профиля: на графике телефона (≈ 350 px) это ≥ 1.7 px. От данных,
// а не от ширины графика — цвет одинаков на графике, у метки на карте и при любом зуме.
const MIN_SECTION = 100;
const MAX_SECTIONS = 200;

export function sectionLength(length: number): number {
    return Math.max(MIN_SECTION, length / MAX_SECTIONS);
}

export interface SlopeSection {
    // номера крайних точек выборки; соседние участки прогона делят точку на границе
    from: number;
    to: number;
    // уклон, % со знаком: разность высот концов на длину
    grade: number;
}

// Участки по прогонам точек с данными внутри отрезков (рвутся там же, где ломаная графика): от начала прогона копим
// точки, пока длина не дойдёт до length; хвост короче length / 2 входит в предыдущий участок прогона.
export function slopeSections(
    profile: Pick<ProfileSamples, 'distances' | 'starts'>,
    values: readonly Elevation[],
    length = sectionLength(profile.distances[profile.distances.length - 1] - profile.distances[0] || 0),
): SlopeSection[] {
    const { distances, starts } = profile;
    const sections: SlopeSection[] = [];
    const grade = (from: number, to: number) =>
        (((values[to] as number) - (values[from] as number)) / (distances[to] - distances[from])) * 100;
    const closeRun = (first: number, last: number) => {
        const before = sections.length;
        let from = first;
        for (let i = first + 1; i <= last; i++) {
            if (distances[i] - distances[from] >= length) {
                sections.push({ from, to: i, grade: grade(from, i) });
                from = i;
            }
        }
        if (from === last || distances[last] <= distances[from]) {
            return;
        }
        const previous = sections.length > before ? sections[sections.length - 1] : null;
        if (previous && distances[last] - distances[from] < length / 2) {
            previous.to = last;
            previous.grade = grade(previous.from, last);
            return;
        }
        sections.push({ from, to: last, grade: grade(from, last) });
    };
    starts.forEach((start, k) => {
        const end = (starts[k + 1] ?? values.length) - 1;
        let first = -1;
        for (let i = start; i <= end; i++) {
            const known = values[i] !== null && values[i] !== undefined;
            if (known && first < 0) {
                first = i;
            }
            if (first >= 0 && (!known || i === end)) {
                closeRun(first, known ? i : i - 1);
                first = -1;
            }
        }
    });
    return sections;
}

// номер ступени по модулю уклона, округлённого до целого — того же числа, что у курсора
export function slopeClass(grade: number): number {
    const percent = Math.round(Math.abs(grade));
    const step = SLOPE_STEPS.findIndex((threshold) => percent < threshold);
    return step < 0 ? SLOPE_STEPS.length : step;
}

// Участок под дробным номером точки; на общей точке двух участков — следующий, на конце прогона — последний его
// участок; вне участков (точки без данных, стык) — null
export function sectionAt(sections: readonly SlopeSection[], index: number): SlopeSection | null {
    let lo = 0;
    let hi = sections.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const section = sections[mid];
        if (index < section.from) {
            hi = mid - 1;
        } else if (index >= section.to) {
            lo = mid + 1;
        } else {
            return section;
        }
    }
    // index точно на конце участка, за которым нет участка с этого же места
    const last = sections[hi];
    return last && index === last.to ? last : null;
}

export interface ScreenPoint {
    x: number;
    y: number;
}

// Ближайшее место на линии профиля к экранной точке cursor: дробный номер точки выборки или null, если дальше
// maxDistance px. Звенья через стык отрезков не считаются. Вместо queryRenderedFeatures по невидимой широкой линии
// старого клиента — проекция: не зависит от отрисованного кадра карты (design, «Курсор на карте»).
export function nearestIndex(
    screen: readonly ScreenPoint[],
    starts: readonly number[],
    cursor: ScreenPoint,
    maxDistance: number,
): number | null {
    let best: number | null = null;
    let bestDistance = maxDistance * maxDistance;
    const isStart = new Set(starts);
    for (let i = 0; i < screen.length; i++) {
        const a = screen[i];
        const pointDistance = (cursor.x - a.x) ** 2 + (cursor.y - a.y) ** 2;
        if (pointDistance <= bestDistance) {
            bestDistance = pointDistance;
            best = i;
        }
        const b = screen[i + 1];
        if (!b || isStart.has(i + 1)) {
            continue;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) {
            continue;
        }
        const t = ((cursor.x - a.x) * dx + (cursor.y - a.y) * dy) / lengthSq;
        if (t <= 0 || t >= 1) {
            continue;
        }
        const segmentDistance = (cursor.x - a.x - t * dx) ** 2 + (cursor.y - a.y - t * dy) ** 2;
        if (segmentDistance < bestDistance) {
            bestDistance = segmentDistance;
            best = i + t;
        }
    }
    return best;
}
