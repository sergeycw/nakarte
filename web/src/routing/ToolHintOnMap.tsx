import { useMap } from '@vis.gl/react-maplibre';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/state/context';
import { toolOrigin } from './line-tools';
import { nearTo } from './MapEditor';

// Подсказка выбора Join и Shortcut у точки, от которой он идёт (макет 4a, design editor-hint-at-point): над точкой, а
// если сверху не хватает места — под ней. Точка за краем карты (карту двигают в поисках цели) — подсказка прижимается
// к краю видимой части, а не пропадает. Клики проходят сквозь неё к карте: под ней может быть линия, по которой
// кликают. Положение пишется в стиль на каждое движение карты и смену размеров, мимо React.

// зазор между точкой и подсказкой, px
const GAP = 12;
// поля видимой части: сверху строка редактора (top-3 в TopBar.tsx + h-11 в EditPanel.tsx; по всей ширине, хотя строка
// только слева), справа столбец контролов, снизу кнопка профиля и линейка масштаба над нижними панелями (--bottom-inset)
const INSET = { top: 64, right: 56, bottom: 60, left: 8 };

export function ToolHintOnMap() {
    const { current } = useMap();
    const map = current?.getMap();
    const tool = useAppStore((state) => state.lineTool);
    const line = useAppStore((state) => state.routeEdit?.line);
    // у Shortcut посреди звена точка — новая проекция на каждый вызов: без memo эффект перезапускался бы каждый рендер
    const origin = useMemo(() => (tool && line ? toolOrigin(line, tool) : null), [tool, line]);
    const ref = useRef<HTMLDivElement>(null);
    // высота нижних панелей в px: --bottom-inset — строка calc(…), getPropertyValue отдаёт её текстом, а не числом
    const probe = useRef<HTMLDivElement>(null);

    // до отрисовки: иначе один кадр подсказка стоит в углу карты
    useLayoutEffect(() => {
        const node = ref.current;
        const inset = probe.current;
        if (!map || !node || !inset || !origin) {
            return;
        }
        const place = () => {
            // копия мира у центра вида: точка из соседней копии ушла бы за край
            const center = map.getCenter();
            const at = nearTo(origin, { lat: center.lat, lng: center.lng });
            const point = map.project([at.lng, at.lat]);
            const container = map.getContainer();
            const width = node.offsetWidth;
            const height = node.offsetHeight;
            const maxX = container.clientWidth - INSET.right - width;
            const maxY = container.clientHeight - inset.offsetHeight - INSET.bottom - height;
            const above = point.y - GAP - height;
            const y = above >= INSET.top ? above : point.y + GAP;
            const x = point.x - width / 2;
            node.style.transform = `translate(${clamp(x, INSET.left, maxX)}px, ${clamp(y, INSET.top, maxY)}px)`;
        };
        place();
        map.on('move', place);
        map.on('resize', place);
        // ширина плашки (догрузился шрифт) и нижние панели (открылся профиль) меняются без движения карты
        const observer = new ResizeObserver(place);
        observer.observe(node);
        observer.observe(inset);
        return () => {
            map.off('move', place);
            map.off('resize', place);
            observer.disconnect();
        };
    }, [map, origin]);

    if (!tool || !origin) {
        return null;
    }
    const hint = tool.kind === 'join' ? 'Click a track line to join it' : 'Click the line where the shortcut ends';
    // font-sans: внутри карты действует шрифт из CSS MapLibre
    return (
        <>
            <div ref={probe} className="pointer-events-none invisible absolute bottom-0 h-(--bottom-inset)" />
            <div
                ref={ref}
                className="glass pointer-events-none absolute top-0 left-0 z-10 max-w-[calc(100%-64px)] truncate rounded-lg px-2.5 py-1 font-medium font-sans text-xs"
                data-testid="tool-hint"
            >
                {hint}
            </div>
        </>
    );
}

// окно уже подсказки (max < min) — берётся min: подсказка у левого или верхнего поля, а не за краем
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}
