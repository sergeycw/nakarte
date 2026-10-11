import { type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, useAppStoreApi } from '@/state/context';
import type { ProfileData } from '@/state/store';
import { cursorInfo, profileSections } from './format';
import { distanceAt, gridValues, indexAtDistance, pointAt, SLOPE_CLASSES, slopeClass } from './profile';

// График профиля — свой SVG (design add-web-elevation-profile, «График: свой SVG»): ломаная по точкам выборки над
// заливкой участков цветом ступени крутизны (design slope-profile), шкала слева, курсор и выделение поверх. Ось X — расстояние, а не номер точки: на концах отрезков шаг
// выборки короче. Мышь: движение — курсор, нажатие со сдвигом — выделение, клик — снять выделение, двойной клик —
// карта в эту точку, колесо — зум 1–10× (прокрутка родная). Палец водит курсор, без выделения и зума.

const PAD_TOP = 8;
const PAD_BOTTOM = 4;
const MAX_ZOOM = 10;
// сдвиг мыши, после которого нажатие — выделение, а не клик
const DRAG_THRESHOLD = 3;

interface Size {
    width: number;
    height: number;
}

function useSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, size] as const;
}

interface Scale {
    grid: number[];
    y: (value: number) => number;
}

function scaleOf(values: readonly (number | null)[], height: number): Scale | null {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const value of values) {
        if (value !== null) {
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }
    if (min > max) {
        return null;
    }
    const grid = gridValues(min, max);
    const low = grid[0];
    const high = grid[grid.length - 1];
    const span = height - PAD_TOP - PAD_BOTTOM;
    return { grid, y: (value) => PAD_TOP + ((high - value) / (high - low)) * span };
}

// Ломаная: прогон рвётся на точке без данных и на стыке отрезков. Заливка — по участкам крутизны, по пути на ступень:
// участки рвутся там же, где ломаная (slopeSections).
function paths(data: ProfileData, width: number, height: number, scale: Scale) {
    const { distances, starts } = data.samples;
    const values = data.values ?? [];
    const first = distances[0];
    const total = distances[distances.length - 1] - first || 1;
    const x = (i: number) => (((distances[i] - first) / total) * (width - 1)).toFixed(1);
    const point = (i: number) => `${x(i)} ${scale.y(values[i] as number).toFixed(1)}`;
    const base = height - PAD_BOTTOM;
    const startSet = new Set(starts);
    const line: string[] = [];
    let run: string[] = [];
    const flush = () => {
        if (run.length > 1) {
            line.push(`M${run.join('L')}`);
        } else if (run.length === 1) {
            line.push(`M${run[0]}h0.5`);
        }
        run = [];
    };
    values.forEach((value, i) => {
        if (startSet.has(i)) {
            flush();
        }
        if (value === null) {
            flush();
            return;
        }
        run.push(point(i));
    });
    flush();
    const fills: string[][] = SLOPE_CLASSES.map(() => []);
    for (const section of profileSections(data)) {
        const outline: string[] = [];
        for (let i = section.from; i <= section.to; i++) {
            outline.push(point(i));
        }
        fills[slopeClass(section.grade)].push(
            `M${x(section.from)} ${base}L${outline.join('L')}L${x(section.to)} ${base}Z`,
        );
    }
    return { line: line.join(''), fills: fills.map((parts) => parts.join('')) };
}

export function ProfileGraph({ data }: { data: ProfileData }) {
    const store = useAppStoreApi();
    const cursor = useAppStore((state) => state.profileCursor);
    const selection = useAppStore((state) => state.profileSelection);
    const [frameRef, frame] = useSize<HTMLDivElement>();
    const scrollRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    // зум и прокрутка, которые ещё не дошли до DOM: два события колеса до рендера считаются от них, а не от старых
    const zoomRef = useRef(1);
    // прокрутка после зума: точка под мышью остаётся на месте (onSvgMouseWheel старого клиента)
    const pendingScroll = useRef<number | null>(null);
    const drag = useRef<{ start: number; x: number; moved: boolean } | null>(null);

    const width = Math.max(frame.width * zoom, 1);
    const height = frame.height;
    const values = data.values ?? [];
    const scale = useMemo(() => scaleOf(values, height), [values, height]);
    const drawn = useMemo(
        () => (scale && width > 1 ? paths(data, width, height, scale) : null),
        [data, width, height, scale],
    );

    const { distances } = data.samples;
    const first = distances[0];
    const total = distances[distances.length - 1] - first || 1;
    const xOf = (index: number) => ((distanceAt(distances, index) - first) / total) * (width - 1);

    function indexAt(clientX: number): number {
        const rect = contentRef.current?.getBoundingClientRect();
        const x = rect ? Math.min(Math.max(clientX - rect.left, 0), width - 1) : 0;
        return indexAtDistance(distances, first + (x / (width - 1)) * total);
    }

    useLayoutEffect(() => {
        if (pendingScroll.current !== null && scrollRef.current) {
            scrollRef.current.scrollLeft = pendingScroll.current;
            pendingScroll.current = null;
        }
    });

    // колесо — зум по горизонтали; слушатель не пассивный (React вешает wheel пассивным), иначе страница не даст
    // отменить прокрутку
    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller) {
            return;
        }
        function onWheel(event: WheelEvent) {
            // горизонтальная прокрутка тачпада — родная
            if (!scroller || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
                return;
            }
            event.preventDefault();
            const old = zoomRef.current;
            const next = Math.min(Math.max(old + (event.deltaY < 0 ? 1 : -1), 1), MAX_ZOOM);
            if (next === old) {
                return;
            }
            const offset = event.clientX - scroller.getBoundingClientRect().left;
            const scrollLeft = pendingScroll.current ?? scroller.scrollLeft;
            const ratio = (scrollLeft + offset) / (scroller.clientWidth * old);
            pendingScroll.current = Math.max(ratio * scroller.clientWidth * next - offset, 0);
            zoomRef.current = next;
            setZoom(next);
        }
        scroller.addEventListener('wheel', onWheel, { passive: false });
        return () => scroller.removeEventListener('wheel', onWheel);
    }, []);

    const state = () => store.getState();

    function onPointerDown(event: ReactPointerEvent) {
        const index = indexAt(event.clientX);
        if (event.pointerType !== 'mouse') {
            state().setProfileCursor(index);
            return;
        }
        if (event.button !== 0) {
            return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = { start: index, x: event.clientX, moved: false };
    }

    function onPointerMove(event: ReactPointerEvent) {
        const index = indexAt(event.clientX);
        state().setProfileCursor(index);
        const current = drag.current;
        if (!current || event.pointerType !== 'mouse') {
            return;
        }
        if (!current.moved && Math.abs(event.clientX - current.x) > DRAG_THRESHOLD) {
            current.moved = true;
        }
        if (current.moved) {
            state().setProfileSelection([Math.min(current.start, index), Math.max(current.start, index)]);
        }
    }

    function onPointerUp(event: ReactPointerEvent) {
        const current = drag.current;
        drag.current = null;
        if (!current || event.pointerType !== 'mouse') {
            return;
        }
        // клик без сдвига снимает выделение (onSvgClick старого клиента)
        if (!current.moved) {
            state().setProfileSelection(null);
        }
    }

    function onPointerLeave(event: ReactPointerEvent) {
        if (event.pointerType === 'mouse' && !drag.current) {
            state().setProfileCursor(null);
        }
    }

    function onDoubleClick(event: React.MouseEvent) {
        const point = pointAt(data.samples.points, indexAt(event.clientX));
        state().requestView({ lat: point.lat, lng: point.lng, zoom: state().view.zoom });
    }

    const info = cursor === null ? null : cursorInfo(data, cursor);
    const cursorX = cursor === null ? 0 : xOf(cursor);
    // подпись курсора у правого края — слева от линии
    const labelLeft = cursorX + 120 > (scrollRef.current?.scrollLeft ?? 0) + frame.width;

    return (
        <div className="flex h-full min-h-0 gap-1">
            <div className="relative w-9 shrink-0 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
                {scale?.grid.map((value) => (
                    <span key={value} className="absolute right-0 -translate-y-1/2" style={{ top: scale.y(value) }}>
                        {value}
                    </span>
                ))}
            </div>
            <div ref={frameRef} className="relative min-w-0 flex-1">
                <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden">
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: график для мыши и пальца, как у старого клиента;
                        цифры профиля доступны текстом в сводке */}
                    <div
                        ref={contentRef}
                        className="relative h-full touch-none select-none"
                        style={{ width }}
                        data-testid="profile-graph"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={() => {
                            drag.current = null;
                        }}
                        onPointerLeave={onPointerLeave}
                        onDoubleClick={onDoubleClick}
                    >
                        <svg width={width} height={height} className="absolute inset-0" aria-hidden>
                            {scale?.grid.map((value) => (
                                <line
                                    key={value}
                                    x1={0}
                                    x2={width}
                                    y1={Math.round(scale.y(value)) + 0.5}
                                    y2={Math.round(scale.y(value)) + 0.5}
                                    className="stroke-border"
                                />
                            ))}
                            {drawn && (
                                <>
                                    {drawn.fills.map((d, step) => (
                                        <path
                                            // biome-ignore lint/suspicious/noArrayIndexKey: ступени постоянны, номер — ключ
                                            key={step}
                                            d={d}
                                            className={SLOPE_CLASSES[step].fill}
                                            data-slope={step}
                                        />
                                    ))}
                                    <path
                                        d={drawn.line}
                                        className="fill-none stroke-foreground/75"
                                        strokeWidth={1.5}
                                        strokeLinejoin="round"
                                        data-testid="profile-line"
                                    />
                                </>
                            )}
                        </svg>
                        {/* выделение приглушает график вокруг: цвета ступеней внутри остаются истинными (design
                            slope-profile, «Выделение») */}
                        {selection && (
                            <>
                                <div
                                    className="pointer-events-none absolute inset-y-0 left-0 bg-background/65"
                                    style={{ width: xOf(selection[0]) }}
                                />
                                <div
                                    className="pointer-events-none absolute inset-y-0 right-0 bg-background/65"
                                    style={{ left: xOf(selection[1]) }}
                                />
                                <div
                                    className="pointer-events-none absolute inset-y-0 border-foreground/50 border-x"
                                    style={{
                                        left: xOf(selection[0]),
                                        width: Math.max(xOf(selection[1]) - xOf(selection[0]), 1),
                                    }}
                                    data-testid="profile-selection"
                                />
                            </>
                        )}
                        {info && (
                            <>
                                <div
                                    className="pointer-events-none absolute inset-y-0 w-px bg-foreground/70"
                                    style={{ left: cursorX }}
                                    data-testid="profile-cursor"
                                />
                                <div
                                    className={`pointer-events-none absolute top-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] leading-tight tabular-nums shadow-sm ring-1 ring-foreground/10 ${labelLeft ? '-translate-x-full' : ''}`}
                                    style={{ left: labelLeft ? cursorX - 6 : cursorX + 6 }}
                                    data-testid="profile-cursor-label"
                                >
                                    <div className="font-medium">{info.elevation}</div>
                                    <div>{info.distance}</div>
                                    <div>{info.slope}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
