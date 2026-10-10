import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTrackActions } from './actions-context';
import { TRACK_COLORS, type Track } from './model';

// Палитра цвета трека: строка списка треков и строка редактора линии (design editor-row-cleanup, «Палитра одна на
// список и редактор»). Список, открытый до начала правки, остаётся до первого нажатия на карту — тогда кнопок
// `Color of <название>` на экране две, и тесты редактора ищут свою внутри edit-panel. Смена цвета меняет только поле
// color и правку линии не прерывает.
export function ColorPicker({ track }: { track: Track }) {
    const actions = useTrackActions();
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button variant="ghost" size="icon-xs" aria-label={`Color of ${track.name}`} className="shrink-0" />
                }
            >
                <span
                    className="block h-1.5 w-4 rounded-full"
                    style={{ backgroundColor: TRACK_COLORS[track.color] }}
                    data-color={track.color}
                />
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-auto flex-row gap-1 p-1.5">
                {TRACK_COLORS.map((color, index) => (
                    <Button
                        key={color}
                        variant={index === track.color ? 'outline' : 'ghost'}
                        size="icon-sm"
                        aria-label={`Color ${index + 1}`}
                        onClick={() => {
                            actions.setColor(track, index);
                            setOpen(false);
                        }}
                    >
                        <span className="block h-1.5 w-4 rounded-full" style={{ backgroundColor: color }} />
                    </Button>
                ))}
            </PopoverContent>
        </Popover>
    );
}
