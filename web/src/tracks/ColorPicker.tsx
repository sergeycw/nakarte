import { useState } from 'react';
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
// color и правку линии не прерывает. Под шестью готовыми цветами — недавние свои и пикер (design track-color-picker):
// готовый и недавний цвет закрывают палитру, свой из пикера — нет, его подбирают за несколько движений.
export function ColorPicker({ track }: { track: Track }) {
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
                    style={{ backgroundColor: trackColor(track.color) }}
                    data-color={track.color}
                />
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-52 gap-2 p-2">
                <Palette track={track} close={() => setOpen(false)} />
            </PopoverContent>
        </Popover>
    );
}

// Содержимое открытой палитры: монтируется при каждом открытии, недавние цвета читаются тогда же. Пока палитра открыта,
// строка недавних не меняется: новая строка сдвинула бы квадрат пикера под пальцем.
function Palette({ track, close }: { track: Track; close: () => void }) {
    const actions = useTrackActions();
    const [recent] = useState(readRecentColors);
    const choose = (color: TrackColor) => {
        if (color !== track.color) {
            actions.setColor(track, color);
        }
    };
    const swatch = (color: string) => (
        <span className="block h-1.5 w-4 rounded-full" style={{ backgroundColor: color }} />
    );
    return (
        <>
            <div className="flex justify-between">
                {TRACK_COLORS.map((color, index) => (
                    <Button
                        key={color}
                        variant={index === track.color ? 'outline' : 'ghost'}
                        size="icon-sm"
                        aria-label={`Color ${index + 1}`}
                        onClick={() => {
                            choose(index);
                            close();
                        }}
                    >
                        {swatch(color)}
                    </Button>
                ))}
            </div>
            {recent.length > 0 && (
                <div className="flex gap-1">
                    {recent.map((color) => (
                        <Button
                            key={color}
                            variant={color === track.color ? 'outline' : 'ghost'}
                            size="icon-sm"
                            aria-label={`Recent color ${color}`}
                            onClick={() => {
                                choose(color);
                                close();
                            }}
                        >
                            {swatch(color)}
                        </Button>
                    ))}
                </div>
            )}
            <HsvPicker
                color={trackColor(track.color)}
                onCommit={(hex) => {
                    choose(normalizeColor(hex));
                    rememberColor(hex);
                }}
            />
        </>
    );
}
