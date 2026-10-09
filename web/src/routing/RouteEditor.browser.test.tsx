import type { LineString } from 'geojson';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { type FakeRouter, fakeRouter } from '@/test/fake-router';
import {
    click,
    dblclick,
    drag,
    editPanel,
    features,
    fire,
    idle,
    key,
    legs,
    near,
    newTrack,
    P,
    pressEscape,
    waypoints,
} from '@/test/map-events';
import { renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';
import type { LatLng } from '@/tracks/model';
import { saveNktk } from '@/tracks/nktk';
import { TRACK_LINES } from '@/tracks/style';
import { RoutingError } from './brouter';
import { EDIT_PREVIEW } from './edit-style';

// Редактор маршрута в App на настоящей карте MapLibre: тайлы — фикстура, роутер — поддельный (тест сам отвечает на
// запросы). Мышь — синтетические события на холсте по map.project: так их получает и MapLibre, и обработчики
// перетаскивания на window. Названия тестов — сценарии спек route-editing, routing и tracks.

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
});

afterEach(() => {
    cleanup();
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

// Тбилиси, зум старого клиента 15: между точками ≈ 100 px
const VIEW = '#m=15/41.69/44.785';
const A = P(41.687, 44.78);
const B = P(41.69, 44.785);
const C = P(41.693, 44.79);
const D = P(41.684, 44.775);

function line(name: string, points: LatLng[]) {
    return saveNktk({ name, segments: [points], points: [] });
}

async function render(hash: string, router: FakeRouter = fakeRouter({ auto: true }), activity?: string) {
    if (activity) {
        localStorage.setItem('nakarte-web:routing-activity', activity);
    }
    const app = await renderApp(tiles, hash, { router });
    return { ...app, router };
}

describe('Начало и конец редактирования', () => {
    test('Начать редактирование', async () => {
        const { map } = await render(`${VIEW}&nktk=${line('Walk', [A, C])}`);
        await expect.poll(() => features(map, TRACK_LINES)).toHaveLength(1);
        await click(map, B);
        await expect.element(editPanel()).toBeVisible();
        await expect.element(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
        await expect.element(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
        await expect.element(page.getByRole('button', { name: 'Done' })).toBeVisible();
        await expect.poll(() => waypoints(map)).toHaveLength(2);
    });

    test('Закончить редактирование', async () => {
        const { map } = await render(`${VIEW}&nktk=${line('Walk', [A, C])}`);
        await click(map, B);
        await expect.element(editPanel()).toBeVisible();
        await click(map, D);
        await expect.element(editPanel()).not.toBeInTheDocument();
        await expect.poll(() => waypoints(map)).toHaveLength(0);
        await expect.poll(() => features(map, TRACK_LINES)).toHaveLength(1);
    });

    test('Пустой новый трек', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A]);
        pressEscape();
        pressEscape();
        await expect.element(editPanel()).not.toBeInTheDocument();
        await expect.element(page.getByRole('list', { name: 'Tracks' })).not.toBeInTheDocument();
    });
});

describe('Клик при рисовании', () => {
    test('Несколько кликов подряд', async () => {
        const { map, router } = await render(VIEW, fakeRouter(), 'hiking');
        await newTrack(map, [A, B, C]);
        // все три опорные точки сразу, отрезки ждут
        await expect.poll(() => waypoints(map)).toHaveLength(3);
        expect(router.live()).toHaveLength(2);
        router.live()[1].resolve([P(41.6915, 44.7875)]);
        router.live()[0].resolve([P(41.6885, 44.7825)]);
        await expect.poll(() => legs(map)).toHaveLength(2);
    });

    test('Ожидание маршрута', async () => {
        const { map, router } = await render(VIEW, fakeRouter(), 'hiking');
        await newTrack(map, [A, B]);
        // между опорными точками разрыв, в середине спиннер
        await expect.element(page.getByTestId('route-spinner')).toBeVisible();
        expect(legs(map)).toHaveLength(0);
        router.live()[0].resolve([]);
        await expect.element(page.getByTestId('route-spinner')).not.toBeInTheDocument();
        await expect.poll(() => legs(map)).toHaveLength(1);
    });

    test('резинка от последней точки к курсору', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A]);
        fire(map, 'mousemove', B);
        await expect
            .poll(() => features<LineString>(map, EDIT_PREVIEW).map((f) => f.geometry.type))
            .toEqual(['LineString']);
    });

    test('Alt-клик', async () => {
        const { map, router } = await render(VIEW, fakeRouter(), 'hiking');
        await newTrack(map, [A]);
        await click(map, B, { altKey: true });
        await expect.poll(() => legs(map)).toHaveLength(1);
        expect(router.calls).toHaveLength(0);
    });
});

describe('Ошибка прокладки', () => {
    test('Нет маршрута', async () => {
        const { map, router } = await render(VIEW, fakeRouter(), 'hiking');
        await newTrack(map, [A, B]);
        router.live()[0].reject(new RoutingError('no route found'));
        // спиннер исчез, между опорными точками помеченная прямая, уведомление с причиной
        await expect.element(page.getByText('Routing failed: no route found')).toBeVisible();
        await expect.poll(() => legs(map).map((f) => f.properties?.unrouted)).toEqual([true]);
        await expect.element(page.getByTestId('route-spinner')).not.toBeInTheDocument();
    });
});

describe('Перетаскивание опорной точки', () => {
    test('Точка между двумя отрезками', async () => {
        const { map, router } = await render(VIEW, fakeRouter({ auto: true }), 'hiking');
        await newTrack(map, [A, B, C]);
        pressEscape();
        const moved = P(41.6915, 44.783);
        await drag(map, B, moved);
        await expect.poll(() => router.calls.length).toBe(4);
        const [toMoved, fromMoved] = router.calls.slice(-2);
        expect(near(toMoved.from, A) && near(toMoved.to, moved)).toBe(true);
        expect(near(fromMoved.from, moved) && near(fromMoved.to, C)).toBe(true);
    });
});

describe('Удаление опорной точки двойным кликом', () => {
    test('Удаление средней точки', async () => {
        const { map, router } = await render(VIEW, fakeRouter({ auto: true }), 'hiking');
        await newTrack(map, [A, B, C]);
        pressEscape();
        await dblclick(map, B);
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        const last = router.calls.at(-1);
        expect(last && near(last.from, A) && near(last.to, C)).toBe(true);
    });
});

describe('Вставка опорной точки на линию', () => {
    test('Вставка с перетаскиванием', async () => {
        const { map, router } = await render(`${VIEW}&nktk=${line('Walk', [A, C])}`, fakeRouter({ auto: true }));
        await click(map, B);
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        const target = P(41.6905, 44.7835);
        await drag(map, B, target);
        // появилась опорная точка, после отпускания соседние прямые остались прямыми
        await expect.poll(() => waypoints(map)).toHaveLength(3);
        expect(near(waypoints(map)[1], target)).toBe(true);
        expect(router.calls).toHaveLength(0);
        // вставка и перетаскивание — один шаг истории
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect.poll(() => waypoints(map)).toHaveLength(2);
    });
});

describe('Undo и redo', () => {
    test('Кнопки Undo и Redo', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A, B]);
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect.poll(() => waypoints(map)).toHaveLength(1);
        await expect.element(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
        await page.getByRole('button', { name: 'Redo' }).click();
        await expect.poll(() => waypoints(map)).toHaveLength(2);
    });

    test('Отмена клика', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A, B]);
        key({ code: 'KeyZ', key: 'z', metaKey: true });
        await expect.poll(() => waypoints(map)).toHaveLength(1);
        key({ code: 'KeyZ', key: 'Z', metaKey: true, shiftKey: true });
        await expect.poll(() => waypoints(map)).toHaveLength(2);
        key({ code: 'KeyZ', key: 'z', ctrlKey: true });
        await expect.poll(() => waypoints(map)).toHaveLength(1);
        key({ code: 'KeyY', key: 'y', ctrlKey: true });
        await expect.poll(() => waypoints(map)).toHaveLength(2);
    });

    test('Хоткей в поле ввода', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A, B]);
        const input = page.getByRole('textbox', { name: 'Track URL' }).element();
        key({ code: 'KeyZ', key: 'z', metaKey: true }, input);
        await idle(map);
        expect(waypoints(map)).toHaveLength(2);
    });
});

describe('Продолжение линии с любого конца', () => {
    test('Конец рисования', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A, B]);
        pressEscape();
        await click(map, C);
        // клик по карте мимо линии без рисования заканчивает редактирование, новой точки нет
        await expect.element(editPanel()).not.toBeInTheDocument();
        await expect.poll(() => features(map, TRACK_LINES)).toHaveLength(1);
        expect(features<LineString>(map, TRACK_LINES)[0].geometry.coordinates).toHaveLength(2);
    });

    test('Дорисовать с начала', async () => {
        // средняя точка не на прямой: ломаную из ссылки упрощают, и точка на прямой пропала бы
        const { map, router } = await render(
            `${VIEW}&nktk=${line('Walk', [A, P(41.692, 44.783), C])}`,
            fakeRouter(),
            'gravel',
        );
        await click(map, P(41.6895, 44.7815));
        await expect.poll(() => waypoints(map)).toHaveLength(3);
        await click(map, A);
        await expect.element(page.getByText('Click map to add points')).toBeVisible();
        await click(map, D);
        await expect.poll(() => waypoints(map)).toHaveLength(4);
        expect(near(waypoints(map)[0], D)).toBe(true);
        expect(router.calls[0].activity.id).toBe('gravel');
        expect(near(router.calls[0].from, D) && near(router.calls[0].to, A)).toBe(true);
    });
});

describe('гонки и фокус', () => {
    test('быстрый клик по только что поставленной точке заканчивает рисование, а не ставит дубль', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A]);
        // без ожидания кадра: точка B ещё не дошла до отрисовки
        for (let i = 0; i < 2; i++) {
            for (const type of ['mousemove', 'mousedown', 'mouseup', 'click']) {
                fire(map, type, B);
            }
        }
        await expect.element(page.getByText('Drag points, click line end to continue')).toBeVisible();
        expect(waypoints(map)).toHaveLength(2);
    });

    test('Enter на кнопке Undo в фокусе нажимает её, а не заканчивает рисование', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A, B]);
        const undo = page.getByRole('button', { name: 'Undo' }).element() as HTMLButtonElement;
        undo.focus();
        key({ key: 'Enter', code: 'Enter' }, undo);
        await expect.element(page.getByText('Click map to add points')).toBeVisible();
    });

    test('Escape, закрывающий меню прокладки, рисование не заканчивает', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A]);
        await page.getByRole('button', { name: /^Routing/ }).click();
        await expect.element(page.getByRole('menuitemradio', { name: 'Hiking' })).toBeVisible();
        await userEvent.keyboard('{Escape}');
        await expect.element(page.getByRole('menuitemradio', { name: 'Hiking' })).not.toBeInTheDocument();
        await expect.element(page.getByText('Click map to add points')).toBeVisible();
    });
});

describe('Меню активностей', () => {
    async function chooseActivity(name: string) {
        await page.getByRole('button', { name: /^Routing/ }).click();
        await page.getByRole('menuitemradio', { name, exact: true }).click();
    }

    test('Выбор активности', async () => {
        const { router } = await render(VIEW);
        await chooseActivity('Gravel bike');
        await expect.element(page.getByRole('button', { name: 'Routing: Gravel bike' })).toBeVisible();
        expect(localStorage.getItem('nakarte-web:routing-activity')).toBe('gravel');
        // движок начинает загружаться до первого клика по карте
        expect(router.warmUps).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Routing: Gravel bike' }).click();
        await expect.element(page.getByRole('menuitemradio', { name: 'Gravel bike' })).toBeChecked();
    });

    test('Прокладка выключена', async () => {
        const { map, router } = await render(VIEW, fakeRouter(), 'hiking');
        await chooseActivity('Off: straight lines');
        await expect.element(page.getByRole('button', { name: 'Routing is off: lines are straight' })).toBeVisible();
        await newTrack(map, [A, B]);
        await expect.poll(() => legs(map)).toHaveLength(1);
        expect(router.calls).toHaveLength(0);
    });

    test('Движок загружается', async () => {
        const router = fakeRouter({ status: 'loading' });
        await render(VIEW, router, 'hiking');
        await expect
            .element(page.getByRole('button', { name: 'Routing: Hiking. BRouter engine is loading' }))
            .toBeVisible();
        router.setStatus('ready');
        // Движок готов
        await expect.element(page.getByRole('button', { name: 'Routing: Hiking', exact: true })).toBeVisible();
    });

    test('Движок в браузере не запустился', async () => {
        const router = fakeRouter({ status: 'failed' });
        await render(VIEW, router, 'hiking');
        // кнопка красная сразу, без маршрута и без открытия меню
        await expect.element(page.getByRole('button', { name: /^Routing/ })).toHaveAttribute('data-state', 'down');
        await page.getByRole('button', { name: /^Routing/ }).click();
        await expect
            .element(page.getByRole('menuitem', { name: 'BRouter is not running, start it with docker compose up -d' }))
            .toBeVisible();
        // открытие меню перепроверяет живость: кнопка красная, подсказка говорит, что делать
        await expect
            .element(page.getByRole('button', { name: /^Routing: Hiking\. BRouter/ }))
            .toHaveAttribute('data-state', 'down');
    });
});

describe('Действия с треком', () => {
    test('Новый трек', async () => {
        const { map } = await render(VIEW);
        await newTrack(map, [A, B]);
        await page.getByRole('button', { name: 'Done' }).click();
        await expect.element(page.getByRole('button', { name: 'New track', exact: true }).last()).toBeVisible();
        await expect.poll(() => features(map, TRACK_LINES)).toHaveLength(1);
    });

    test('Добавить отрезок', async () => {
        const { map } = await render(`${VIEW}&nktk=${line('Walk', [A, B])}`);
        await page.getByRole('button', { name: 'Actions for Walk' }).click();
        await page.getByRole('menuitem', { name: 'Add segment' }).click();
        await click(map, C);
        await click(map, D);
        await page.getByRole('button', { name: 'Done' }).click();
        await expect.poll(() => features(map, TRACK_LINES).map((f) => f.properties?.segment)).toEqual([0, 1]);
    });
});
