import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { page } from 'vitest/browser';
import { EDIT_LEGS, EDIT_WAYPOINTS } from '@/routing/edit-style';
import type { LatLng } from '@/tracks/model';

// Мышь и клавиатура на настоящей карте MapLibre для browser-тестов редактора: синтетические события на холсте по
// map.project — так их получает и MapLibre, и обработчики перетаскивания на window (design add-web-route-editor).

export const P = (lat: number, lng: number) => ({ lat, lng });

export function features<T extends LineString | Point>(map: MaplibreMap, id: string) {
    const source = map.getSource(id);
    if (!source) {
        throw new Error(`нет источника ${id}`);
    }
    return (source.serialize() as { data: FeatureCollection<T> }).data.features;
}

export const waypoints = (map: MaplibreMap) =>
    features<Point>(map, EDIT_WAYPOINTS).map((f) => P(f.geometry.coordinates[1], f.geometry.coordinates[0]));
export const legs = (map: MaplibreMap) => features<LineString>(map, EDIT_LEGS);

// карта дорисовала последние данные источников: без этого queryRenderedFeatures ещё не видит новые точки
export function idle(map: MaplibreMap) {
    return new Promise<void>((resolve) => {
        map.once('idle', () => resolve());
        map.triggerRepaint();
    });
}

export function fire(map: MaplibreMap, type: string, at: LatLng, init: MouseEventInit = {}) {
    const rect = map.getCanvasContainer().getBoundingClientRect();
    const point = map.project([at.lng, at.lat]);
    map.getCanvas().dispatchEvent(
        new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: rect.left + point.x,
            clientY: rect.top + point.y,
            ...init,
        }),
    );
}

export async function click(map: MaplibreMap, at: LatLng, init: MouseEventInit = {}) {
    await idle(map);
    fire(map, 'mousemove', at, init);
    fire(map, 'mousedown', at, init);
    fire(map, 'mouseup', at, init);
    fire(map, 'click', at, init);
    await idle(map);
}

export async function drag(map: MaplibreMap, from: LatLng, to: LatLng) {
    await idle(map);
    fire(map, 'mousemove', from);
    fire(map, 'mousedown', from);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
        fire(
            map,
            'mousemove',
            P(from.lat + ((to.lat - from.lat) * i) / steps, from.lng + ((to.lng - from.lng) * i) / steps),
        );
    }
    fire(map, 'mouseup', to);
    fire(map, 'click', to);
    await idle(map);
}

export async function dblclick(map: MaplibreMap, at: LatLng) {
    await click(map, at);
    await click(map, at);
    fire(map, 'dblclick', at);
    await idle(map);
}

export function key(init: KeyboardEventInit, target: EventTarget = document.body) {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

export const pressEscape = () => key({ key: 'Escape', code: 'Escape' });

// координаты синтетических событий мыши — целые пиксели: на этом зуме пиксель ≈ 0.00004°
export const near = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;

export async function newTrack(map: MaplibreMap, points: LatLng[]) {
    await page.getByRole('button', { name: 'New track' }).first().click();
    for (const point of points) {
        await click(map, point);
    }
}

export function editPanel() {
    return page.getByTestId('edit-panel');
}
