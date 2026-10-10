import { FlameIcon, MountainSnowIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { ROUND_BUTTON } from '@/components/round-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/state/context';
import type { LayerDef } from './catalog';

// Быстрые слои справа (design layer-thumbnails): превью первых подложек списка и переключатели двух оверлеев. Полный
// список — кнопка All layers в LayerSwitcher.

const QUICK_BASES = 4;

// Оверлеи с переключателем — примеры владельца из ресёрча user-flows; иконки вместо превью: тайлы оверлеев прозрачные
const QUICK_OVERLAYS: { code: string; Icon: ComponentType }[] = [
    { code: 'Sa', Icon: FlameIcon },
    { code: 'Hs', Icon: MountainSnowIcon },
];

// Картинки из сборки (scripts/layer-thumbnails.mjs): тайлов ради превью приложение не запрашивает. Файлы меньше 4 КБ
// Vite встраивает в бандл (assetsInlineLimit)
const THUMBNAILS = import.meta.glob<string>('./thumbnails/*.webp', { eager: true, import: 'default' });

function thumbnailOf(code: string): string | undefined {
    return THUMBNAILS[`./thumbnails/${code}.webp`];
}

// Подложки в превью: первые QUICK_BASES списка в порядке каталога, выбранная вне их — последней. Порядок стабилен:
// выбор подложки круги не переставляет
export function quickBases(bases: LayerDef[], selected: string): LayerDef[] {
    const first = bases.slice(0, QUICK_BASES);
    if (first.some((layer) => layer.code === selected)) {
        return first;
    }
    const current = bases.find((layer) => layer.code === selected);
    return current ? [...first.slice(0, QUICK_BASES - 1), current] : first;
}

// Подложка без картинки (свой слой, Tracestrack без ключа прокси) — буквы названия: «Tracestrack Topo» → TT
function initials(title: string): string {
    const words = title.split(/\s+/u).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
}

// Включённые кнопки — заливка --primary, как Street View (MapButtons). hover ROUND_BUTTON белит фон — у включённой свой
const PRESSED = 'bg-primary! text-primary-foreground hover:bg-primary/90!';

export function QuickBases({ bases }: { bases: LayerDef[] }) {
    const selected = useAppStore((state) => state.selection.base);
    const selectBase = useAppStore((state) => state.selectBase);
    return quickBases(bases, selected).map((layer) => {
        const thumbnail = thumbnailOf(layer.code);
        const active = layer.code === selected;
        return (
            <Button
                key={layer.code}
                variant="ghost"
                size="icon-lg"
                className={cn(
                    ROUND_BUTTON,
                    'overflow-hidden p-0 font-semibold text-[11px] text-muted-foreground',
                    // outline-solid: у Button outline-none, tailwind-merge заменяет его только тем же свойством
                    active && 'outline-solid outline-2 outline-primary outline-offset-2',
                )}
                aria-label={layer.title}
                title={layer.title}
                aria-pressed={active}
                onClick={() => selectBase(layer.code)}
            >
                {thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" /> : initials(layer.title)}
            </Button>
        );
    });
}

export function QuickOverlays({ overlays }: { overlays: LayerDef[] }) {
    const enabled = useAppStore((state) => state.selection.overlays);
    const toggleOverlay = useAppStore((state) => state.toggleOverlay);
    return QUICK_OVERLAYS.map(({ code, Icon }) => {
        const layer = overlays.find((overlay) => overlay.code === code);
        if (!layer) {
            return null;
        }
        const active = enabled.includes(code);
        return (
            <Button
                key={code}
                variant="ghost"
                size="icon-lg"
                className={cn(ROUND_BUTTON, active && PRESSED)}
                aria-label={layer.title}
                title={layer.title}
                aria-pressed={active}
                onClick={() => toggleOverlay(code)}
            >
                <Icon />
            </Button>
        );
    });
}
