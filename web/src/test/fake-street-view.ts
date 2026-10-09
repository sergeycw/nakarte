import type { StreetViewApi, StreetViewHandlers } from '@/streetview/api';
import type { PanoView } from '@/streetview/hash';
import type { LatLng } from '@/tracks/model';

// Street View для browser-тестов без Google (проп streetView у App): панорамы — в точках coverage, ближайшая в радиусе;
// окно — div с текущим видом в атрибутах, тест поворачивает его и «идёт» по панораме сам (turn, walk).

export interface FakeStreetView {
    api: StreetViewApi;
    searches: { at: LatLng; radius: number }[];
    viewers: number;
    destroyed: number;
    // повернуть или перевести открытое окно, как пользователь в панораме
    turn(heading: number): void;
    walk(to: LatLng): void;
    // следующие вызовы API падают, как незагрузившийся скрипт Google
    fail(): void;
}

const METERS_PER_DEGREE = 111_320;

export function fakeStreetView(coverage: LatLng[]): FakeStreetView {
    let failing = false;
    let current: { view: PanoView; handlers: StreetViewHandlers; element: HTMLElement } | null = null;

    function render() {
        if (!current) {
            return;
        }
        const { view, element } = current;
        element.dataset.view = `${view.lat.toFixed(5)},${view.lng.toFixed(5)},${view.heading}`;
        element.textContent = `panorama ${view.lat.toFixed(5)} ${view.lng.toFixed(5)}`;
    }

    function change(view: PanoView) {
        if (!current) {
            return;
        }
        current.view = view;
        render();
        current.handlers.onChange(view);
    }

    const fake: FakeStreetView = {
        searches: [],
        viewers: 0,
        destroyed: 0,
        api: {
            async findPanorama(at, radius) {
                fake.searches.push({ at, radius });
                if (failing) {
                    throw new Error('Maps JavaScript API failed to load');
                }
                const meters = (p: LatLng) =>
                    Math.hypot(p.lat - at.lat, (p.lng - at.lng) * Math.cos((at.lat * Math.PI) / 180)) *
                    METERS_PER_DEGREE;
                const nearest = [...coverage].sort((a, b) => meters(a) - meters(b))[0];
                return nearest && meters(nearest) <= radius ? nearest : null;
            },
            async createViewer(container, handlers) {
                if (failing) {
                    throw new Error('Maps JavaScript API failed to load');
                }
                fake.viewers += 1;
                const element = document.createElement('div');
                element.dataset.testid = 'fake-panorama';
                container.append(element);
                const viewer = { view: { lat: 0, lng: 0, heading: 0, pitch: 0, zoom: 1 }, handlers, element };
                current = viewer;
                return {
                    show(view) {
                        if (current === viewer) {
                            change(view);
                        }
                    },
                    resize() {},
                    destroy() {
                        fake.destroyed += 1;
                        element.remove();
                        if (current === viewer) {
                            current = null;
                        }
                    },
                };
            },
        },
        turn(heading) {
            if (current) {
                change({ ...current.view, heading });
            }
        },
        walk(to) {
            if (current) {
                change({ ...current.view, ...to });
            }
        },
        fail() {
            failing = true;
        },
    };
    return fake;
}
