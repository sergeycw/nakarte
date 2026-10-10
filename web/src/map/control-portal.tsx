import { useControl } from '@vis.gl/react-maplibre';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Свой контрол MapLibre справа сверху: контейнер контрола с порталом React. Так кнопки приложения встают в один
// столбец с кнопками MapLibre — в порядке монтирования (MapLibre добавляет контролы top-right вниз). Быстрые слои
// (LayerSwitcher) — first: встают над Street View, зумом и геолокацией и после перемонтажа (HMR, key), а не только
// потому, что рендерятся до MapButtons (design layer-thumbnails)

// Контейнер контрола MapLibre для портала React
function useControlContainer(className: string, first: boolean): HTMLElement {
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
    // эффект useControl с addControl уже прошёл: контейнер в столбце, переносим его наверх
    useEffect(() => {
        if (first) {
            container.parentElement?.prepend(container);
        }
    }, [container, first]);
    return container;
}

export function ControlPortal({
    className,
    first = false,
    children,
}: {
    className: string;
    first?: boolean;
    children: ReactNode;
}) {
    return createPortal(children, useControlContainer(className, first));
}
