import type { LatLng } from '@/tracks/model';
import type { PanoView } from './hash';

// Street View за своим интерфейсом (design add-web-search-panoramas, «Модули»): приложение не знает про Google, а
// browser-тесты и e2e подставляют своё окно без сети (src/test/fake-street-view.ts, заглушка API в e2e/fixtures.ts).

export interface StreetViewHandlers {
    // окно перешло в другую точку или повернулось
    onChange(view: PanoView): void;
}

export interface StreetViewViewer {
    show(view: PanoView): void;
    // контейнер поменял размер
    resize(): void;
    // окно больше не нужно: слушатели сняты, панорама спрятана
    destroy(): void;
}

export interface StreetViewApi {
    // ближайшая панорама в радиусе (метры) или null; ошибка загрузки API — исключение
    findPanorama(at: LatLng, radius: number): Promise<LatLng | null>;
    createViewer(container: HTMLElement, handlers: StreetViewHandlers): Promise<StreetViewViewer>;
}
