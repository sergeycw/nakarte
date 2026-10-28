import { FlameIcon, MountainSnowIcon, SatelliteIcon } from 'lucide-react';
import { type ComponentType, useEffect, useRef } from 'react';
import { ROUND_BUTTON } from '@/components/round-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/state/context';
import type { LayerDef } from './catalog';
import { QUICK_BASES } from './quick-bases';
import { DEFAULT_SELECTION } from './selection';

// Быстрые слои справа (design layer-thumbnails, design three-quick-bases): три превью подложек по типу и переключатели
// двух оверлеев. Полный список — кнопка All layers в LayerSwitcher.

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

// Круглая кнопка внутри контрола MapLibre: его CSS вне @layer на наведении и нажатии ставит кнопкам
// .maplibregl-ctrl button фон rgba(0, 0, 0, 0.05) и перебивает hover ROUND_BUTTON — отсюда !
export const COLUMN_BUTTON = cn(ROUND_BUTTON, 'hover:bg-white/90! active:bg-white/90!');

// Включённые кнопки — заливка --primary, как Street View (MapButtons); hover ghost-кнопки темнит иконку — у включённой свой
const PRESSED =
    'bg-primary! text-primary-foreground hover:bg-primary/90! hover:text-primary-foreground active:bg-primary/90!';

// Три превью — всегда одни и те же подложки QUICK_BASES (владелец 2026-10-28), даже скрытые в Configure layers: это
// функция столбца, как QuickDated. Подложка не из трёх (выбранная в All layers, OSM после отката Tracestrack) в столбец
// не встаёт, и тогда не отмечено ни одно превью. Подписей нет: превью сняты по типу и различаются картинкой
export function QuickBases() {
    const layers = useAppStore((state) => state.layers);
    const selected = useAppStore((state) => state.selection.base);
    const selectBase = useAppStore((state) => state.selectBase);
    return QUICK_BASES.map((code) => {
        const layer = layers.get(code);
        if (!layer) {
            return null;
        }
        const active = code === selected;
        return (
            <Button
                key={code}
                variant="ghost"
                size="icon-lg"
                className={cn(
                    COLUMN_BUTTON,
                    'overflow-hidden p-0',
                    // outline-solid: у Button outline-none, cn заменяет его только тем же свойством
                    active && 'outline-solid outline-2 outline-primary outline-offset-2',
                )}
                aria-label={layer.title}
                title={layer.title}
                aria-pressed={active}
                onClick={() => selectBase(code)}
            >
                {/* без указателя: картинку иначе тащит мышь, и click не доходит до кнопки */}
                <img
                    src={thumbnailOf(code)}
                    alt=""
                    draggable={false}
                    className="pointer-events-none size-full object-cover"
                />
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
