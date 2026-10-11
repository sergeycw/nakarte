import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { type Hsv, hexToHsv, hsvToHex, parseHex } from './color';

// Пикер своего цвета под палитрой (design track-color-picker, «Пикер: своя вёрстка»): квадрат насыщенности и яркости,
// полоса оттенка, поле hex. Состояние — HSV, а не hex: на чёрном и сером оттенок иначе терялся бы. Наружу цвет уходит
// (onCommit) в конце перетаскивания, по отпусканию стрелки и по вводу hex: пока тянут или держат стрелку, меняются только
// ручка, образец и поле — каждое изменение трека пересобирает GeoJSON всех треков и пишет автосохранение. Показанный, но не
// применённый цвет (набранный hex без Enter) уходит в onDraft: палитра применяет его при закрытии.

const HUE_GRADIENT = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';

function clamp(value: number, max: number): number {
    return Math.min(max, Math.max(0, value));
}

// Доля 0–1 положения указателя в элементе по каждой оси
function fraction(event: PointerEvent<HTMLElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
        x: clamp((event.clientX - rect.left) / rect.width, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 1),
    };
}

// Перетаскивание мышью и пальцем одним кодом: захват указателя держит движение за элементом и за краем поповера.
// Захват может не взяться (указатель уже не активен) или потеряться: тогда конец — по lostpointercapture или по первому
// движению без нажатой кнопки, иначе цвет ездил бы за мышью без нажатия.
function useDrag(move: (event: PointerEvent<HTMLElement>) => void, end: () => void) {
    const dragging = useRef(false);
    const finish = () => {
        if (!dragging.current) {
            return;
        }
        dragging.current = false;
        end();
    };
    return {
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
            if (event.button !== 0) {
                return;
            }
            dragging.current = true;
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // указатель не активен: без захвата
            }
            move(event);
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            if (!dragging.current) {
                return;
            }
            if (event.buttons === 0) {
                finish();
                return;
            }
            move(event);
        },
        onPointerUp: finish,
        onPointerCancel: finish,
        onLostPointerCapture: finish,
    };
}

// Шаг стрелки — 1, с Shift — 10; null — клавиша не стрелка
function arrowStep(event: KeyboardEvent): { x: number; y: number } | null {
    const step = event.shiftKey ? 10 : 1;
    const steps: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: step },
        ArrowDown: { x: 0, y: -step },
    };
    return steps[event.key] ?? null;
}

export function HsvPicker({
    color,
    onCommit,
    onDraft,
}: {
    color: string;
    onCommit: (hex: string) => void;
    // цвет, который пикер показывает, но ещё не применил; null — применять нечего
    onDraft: (hex: string | null) => void;
}) {
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
    const [text, setText] = useState(color);
    const [source, setSource] = useState(color);
    const latest = useRef(hsv);
    // цвет трека сменился снаружи (готовый цвет, другой трек): пикер встаёт на него; свой же применённый цвет HSV не
    // трогает — иначе оттенок чёрного или серого сбросился бы
    if (source !== color) {
        setSource(color);
        setText(color);
        if (hsvToHex(latest.current) !== color) {
            latest.current = hexToHsv(color);
            setHsv(latest.current);
        }
    }

    const show = (next: Hsv) => {
        latest.current = next;
        setHsv(next);
        setText(hsvToHex(next));
        onDraft(hsvToHex(next));
    };
    const commit = () => {
        onDraft(null);
        onCommit(hsvToHex(latest.current));
    };

    const area = useDrag((event) => {
        const { x, y } = fraction(event);
        show({ ...latest.current, s: x * 100, v: (1 - y) * 100 });
    }, commit);
    const hue = useDrag((event) => show({ ...latest.current, h: fraction(event).x * 360 }), commit);

    const onAreaKey = (event: KeyboardEvent) => {
        const step = arrowStep(event);
        if (!step) {
            return;
        }
        event.preventDefault();
        show({ ...latest.current, s: clamp(latest.current.s + step.x, 100), v: clamp(latest.current.v + step.y, 100) });
    };
    const onHueKey = (event: KeyboardEvent) => {
        const step = arrowStep(event);
        if (!step) {
            return;
        }
        event.preventDefault();
        show({ ...latest.current, h: clamp(latest.current.h + step.x + step.y, 360) });
    };
    // стрелку применяет отпускание: удержание с автоповтором не пишет трек на каждый шаг
    const onArrowUp = (event: KeyboardEvent) => {
        if (arrowStep(event)) {
            commit();
        }
    };

    // Неверный hex при Enter или уходе из поля возвращает цвет трека
    const commitText = () => {
        const hex = parseHex(text);
        if (!hex) {
            latest.current = hexToHsv(color);
            setHsv(latest.current);
            setText(color);
            onDraft(null);
            return;
        }
        if (hex !== hsvToHex(latest.current)) {
            latest.current = hexToHsv(hex);
            setHsv(latest.current);
        }
        setText(hex);
        onDraft(null);
        onCommit(hex);
    };

    const current = hsvToHex(hsv);
    return (
        <div className="flex flex-col gap-2">
            <div
                role="slider"
                tabIndex={0}
                aria-label="Saturation and brightness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(hsv.s)}
                aria-valuetext={`Saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%`}
                className="relative h-30 w-full cursor-crosshair touch-none select-none rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{
                    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`,
                }}
                onKeyDown={onAreaKey}
                onKeyUp={onArrowUp}
                {...area}
            >
                <span
                    className="pointer-events-none absolute size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]"
                    style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: current }}
                />
            </div>
            {/* полоса 14 px, а зона нажатия — 24 px по высоте: по тонкой полосе трудно попасть пальцем */}
            <div
                role="slider"
                tabIndex={0}
                aria-label="Hue"
                aria-valuemin={0}
                aria-valuemax={360}
                aria-valuenow={Math.round(hsv.h)}
                className="relative mx-2 flex h-6 cursor-pointer touch-none select-none items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onKeyDown={onHueKey}
                onKeyUp={onArrowUp}
                {...hue}
            >
                <span
                    className="pointer-events-none block h-3.5 w-full rounded-full"
                    style={{ background: HUE_GRADIENT }}
                />
                <span
                    className="pointer-events-none absolute top-1/2 size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]"
                    style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
                />
            </div>
            <div className="flex items-center gap-2">
                <span
                    className="block size-7 shrink-0 rounded-md border border-black/10"
                    style={{ backgroundColor: current }}
                />
                <Input
                    aria-label="Hex color"
                    className="h-7 font-mono"
                    value={text}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => {
                        setText(event.target.value);
                        const hex = parseHex(event.target.value);
                        onDraft(hex);
                        if (hex) {
                            latest.current = hexToHsv(hex);
                            setHsv(latest.current);
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            commitText();
                        }
                    }}
                    onBlur={commitText}
                />
            </div>
        </div>
    );
}
