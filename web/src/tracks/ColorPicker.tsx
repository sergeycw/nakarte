import { type RefObject, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTrackActions } from './actions-context';
import { normalizeColor } from './color';
import { HsvPicker } from './HsvPicker';
import { TRACK_COLORS, type Track, type TrackColor, trackColor } from './model';
import { readRecentColors, rememberColor } from './recent-colors';

// Палитра цвета трека: строка списка треков и строка редактора линии (design editor-row-cleanup, «Палитра одна на
// список и редактор»). Список, открытый до начала правки, остаётся до первого нажатия на карту — тогда кнопок
// `Color of <название>` на экране две, и тесты редактора ищут свою внутри edit-panel. Смена цвета меняет только поле
// color и правку линии не прерывает. Строка цветов — недавние свои и готовые, под ней пикер (design track-color-picker):
// цвет из строки закрывает палитру, свой из пикера — нет, его подбирают за несколько движений.
export function ColorPicker({ track }: { track: Track }) {
    const [open, setOpen] = useState(false);
    const popup = useRef<HTMLDivElement>(null);
    const selected = useRef<HTMLButtonElement>(null);
    // Фокус при открытии (design palette-one-row): мышью и пальцем — на сам попап, без рамки на кнопке цвета (рамка
    // первой кнопки выглядела как выбранный цвет); с клавиатуры — на выбранный цвет строки, иначе как у Base UI. Фокус не
    // остаётся на кнопке-триггере: Escape там дошёл бы до редактора линии, а попап (role="dialog") редактор пропускает.
    const initialFocus = (type: string) => (type === 'keyboard' ? (selected.current ?? true) : popup.current);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button variant="ghost" size="icon-xs" aria-label={`Color of ${track.name}`} className="shrink-0" />
                }
            >
                <span
                    className="block h-1.5 w-4 rounded-full"
                    style={{ backgroundColor: trackColor(track.color) }}
                    data-color={track.color}
                />
            </PopoverTrigger>
            <PopoverContent
                ref={popup}
                initialFocus={initialFocus}
                side="bottom"
                align="start"
                className="w-52 gap-2 p-2"
            >
                <Palette track={track} close={() => setOpen(false)} selected={selected} />
            </PopoverContent>
        </Popover>
    );
}

// Содержимое открытой палитры: монтируется при каждом открытии, недавние цвета читаются тогда же. Пока палитра открыта,
// строка цветов не меняется: новый недавний цвет сдвинул бы готовые под пальцем. При закрытии (любом, и Escape тоже)
// применяется показанный, но не применённый цвет пикера — набранный hex без Enter (что видно в образце, то и у трека),
// а в недавние уходит один цвет — последний свой, применённый за это открытие: стрелки и короткие перетаскивания иначе
// вытеснили бы недавние почти одинаковыми оттенками.
function Palette({
    track,
    close,
    selected,
}: {
    track: Track;
    close: () => void;
    selected: RefObject<HTMLButtonElement | null>;
}) {
    const actions = useTrackActions();
    const [recent] = useState(readRecentColors);
    // трек на момент закрытия: эффект закрытия видит замыкание первого рендера
    const current = useRef(track);
    current.current = track;
    const draft = useRef<string | null>(null);
    const applied = useRef<string | null>(null);
    const choose = (color: TrackColor) => {
        draft.current = null;
        if (typeof color === 'string') {
            applied.current = color;
        }
        if (color !== current.current.color) {
            actions.setColor(current.current, color);
        }
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: только при закрытии, choose читает refs
    useEffect(
        () => () => {
            if (draft.current) {
                choose(normalizeColor(draft.current));
            }
            if (applied.current) {
                rememberColor(applied.current);
            }
        },
        [],
    );
    // одна строка из шести (design palette-one-row): недавние свои слева, за ними готовые по порядку, лишние готовые
    // справа не видны; номер готового цвета в подписи не зависит от места в строке. Выбранный готовый, выпавший из строки
    // (цвета по кругу дают 4–6-му треку красный, розовый, жёлтый), встаёт последним: строка без выбранного путала.
    const presets = TRACK_COLORS.map((color, index) => ({
        color,
        value: index as TrackColor,
        label: `Color ${index + 1}`,
    }));
    const row = [
        ...recent.map((color) => ({ color, value: color as TrackColor, label: `Recent color ${color}` })),
        ...presets,
    ].slice(0, TRACK_COLORS.length);
    const hidden = presets.find((item) => item.value === track.color && !row.includes(item));
    if (hidden) {
        row[row.length - 1] = hidden;
    }
    const swatch = (color: string) => (
        <span className="block h-1.5 w-4 rounded-full" style={{ backgroundColor: color }} />
    );
    return (
        <>
            <div className="flex justify-between">
                {row.map(({ color, value, label }) => (
                    <Button
                        key={label}
                        ref={value === track.color ? selected : undefined}
                        variant={value === track.color ? 'outline' : 'ghost'}
                        size="icon-sm"
                        aria-label={label}
                        onClick={() => {
                            choose(value);
                            close();
                        }}
                    >
                        {swatch(color)}
                    </Button>
                ))}
            </div>
            <HsvPicker
                color={trackColor(track.color)}
                onCommit={(hex) => choose(normalizeColor(hex))}
                onDraft={(hex) => {
                    draft.current = hex;
                }}
            />
        </>
    );
}
