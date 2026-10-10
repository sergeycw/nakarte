import { useControl } from '@vis.gl/react-maplibre';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

// Свой контрол MapLibre справа сверху: контейнер контрола с порталом React. Так кнопки приложения встают в один
// столбец с кнопками MapLibre — в порядке монтирования (MapLibre добавляет контролы top-right вниз): быстрые слои
// (LayerSwitcher) рендерятся до MapButtons и стоят выше Street View, зума и геолокации (design layer-thumbnails)

// Контейнер контрола MapLibre для портала React
function useControlContainer(className: string): HTMLElement {
    const [container] = useState(() => {
        const element = document.createElement('div');
        element.className = `maplibregl-ctrl ${className}`;
        return element;
    });
    useControl(
        () => ({
            onAdd: () => container,
            onRemove: () => container.remove(),
        }),
        { position: 'top-right' },
    );
    return container;
}

export function ControlPortal({ className, children }: { className: string; children: ReactNode }) {
    return createPortal(children, useControlContainer(className));
}
