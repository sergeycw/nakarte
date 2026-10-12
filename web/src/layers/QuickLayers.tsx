import { FlameIcon, MountainSnowIcon, SatelliteIcon } from 'lucide-react';
import { type ComponentType, useEffect, useRef } from 'react';
import { ROUND_BUTTON } from '@/components/round-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/state/context';
import type { LayerDef } from './catalog';
import { DEFAULT_SELECTION } from './selection';

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

// Подложки в превью: первые QUICK_BASES списка (listed — без скрытых в Configure layers) в порядке каталога, выбранная
// вне их — последней, даже если скрыта (current). Порядок стабилен: выбор подложки круги не переставляет
// Снимки по датам в превью не попадают: у них своя кнопка QuickDated (design quick-dated-imagery)
function quickBases(listed: LayerDef[], selected: LayerDef | undefined): LayerDef[] {
    const current = selected?.dated ? undefined : selected;
    const first = listed.filter((layer) => !layer.dated).slice(0, QUICK_BASES);
    if (!current || first.includes(current)) {
        return first;
    }
    return [...first.slice(0, QUICK_BASES - 1), current];
}

// Подложка без картинки (свой слой или тайл, который скрипт превью не скачал) — буквы названия: «Tracestrack Topo» → TT
function initials(title: string): string {
    const words = title.split(/\s+/u).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
}

// Круглая кнопка внутри контрола MapLibre: его CSS вне @layer на наведении и нажатии ставит кнопкам
// .maplibregl-ctrl button фон rgba(0, 0, 0, 0.05) и перебивает hover ROUND_BUTTON — отсюда !
export const COLUMN_BUTTON = cn(ROUND_BUTTON, 'hover:bg-white/90! active:bg-white/90!');

// Включённые кнопки — заливка --primary, как Street View (MapButtons); hover ghost-кнопки темнит иконку — у включённой свой
const PRESSED =
    'bg-primary! text-primary-foreground hover:bg-primary/90! hover:text-primary-foreground active:bg-primary/90!';

export function QuickBases({ listed, all }: { listed: LayerDef[]; all: LayerDef[] }) {
    const selected = useAppStore((state) => state.selection.base);
    const selectBase = useAppStore((state) => state.selectBase);
    const current = all.find((layer) => layer.code === selected);
    return quickBases(listed, current).map((layer) => {
        const thumbnail = thumbnailOf(layer.code);
        const active = layer.code === selected;
        return (
            <Button
                key={layer.code}
                variant="ghost"
                size="icon-lg"
                className={cn(
                    COLUMN_BUTTON,
                    'overflow-hidden p-0 font-semibold text-[11px] text-muted-foreground',
                    // outline-solid: у Button outline-none, cn заменяет его только тем же свойством
                    active && 'outline-solid outline-2 outline-primary outline-offset-2',
                )}
                aria-label={layer.title}
                title={layer.title}
                aria-pressed={active}
                onClick={() => selectBase(layer.code)}
            >
                {thumbnail ? (
                    // без указателя: картинку иначе тащит мышь, и click не доходит до кнопки
                    <img
                        src={thumbnail}
                        alt=""
                        draggable={false}
                        className="pointer-events-none size-full object-cover"
                    />
                ) : (
                    initials(layer.title)
                )}
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
                className={cn(COLUMN_BUTTON, active && PRESSED)}
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

// Снимки по датам — своей кнопкой под превью (владелец 2026-10-12, design quick-dated-imagery): нажатие выбирает их,
// повторное возвращает подложку, выбранную до них, а без неё (ссылка сразу с l=Hls) — подложку по умолчанию. Кнопка
// есть, даже если слой скрыт в Configure layers: это функция, а не строка списка
export function QuickDated() {
    const layers = useAppStore((state) => state.layers);
    const selected = useAppStore((state) => state.selection.base);
    const selectBase = useAppStore((state) => state.selectBase);
    const lastBase = useRef<string | null>(null);
    const dated = [...layers.values()].find((layer) => layer.dated);
    const active = dated !== undefined && selected === dated.code;
    useEffect(() => {
        if (!layers.get(selected)?.dated) {
            lastBase.current = selected;
        }
    }, [layers, selected]);
    if (!dated) {
        return null;
    }
    return (
        <Button
            variant="ghost"
            size="icon-lg"
            className={cn(COLUMN_BUTTON, active && PRESSED)}
            aria-label={dated.title}
            title={dated.title}
            aria-pressed={active}
            onClick={() => {
                if (!active) {
                    selectBase(dated.code);
                    return;
                }
                // прежняя подложка могла пропасть (удалённый свой слой) — тогда подложка по умолчанию
                const previous = lastBase.current;
                selectBase(previous && layers.has(previous) ? previous : DEFAULT_SELECTION.base);
            }}
        >
            <SatelliteIcon />
        </Button>
    );
}
