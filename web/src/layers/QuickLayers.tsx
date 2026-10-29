import { ChevronDownIcon, FlameIcon, SatelliteIcon } from 'lucide-react';
import { type ComponentType, type RefObject, useEffect, useRef } from 'react';
import { ROUND_BUTTON } from '@/components/round-button';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/state/context';
import { savedSelection } from '@/state/store';
import type { LayerDef } from './catalog';
import { QUICK_BASE_GROUPS, QUICK_OVERLAY_GROUPS, type QuickLayerGroup, quickTarget } from './quick-layers';
import { DEFAULT_SELECTION } from './selection';
import { isListed, type LayerSettings } from './settings';

// Быстрые слои справа (design layer-thumbnails, design three-quick-bases, design quick-layer-menus): три круга подложек
// по типу и кнопка тепловой карты Strava, у каждого меню своей группы под значком. Полный список — кнопка All layers в
// LayerSwitcher.

// Иконки кнопок оверлеев по первому коду группы QUICK_OVERLAY_GROUPS; иконки вместо превью: тайлы оверлеев прозрачные
const OVERLAY_ICONS: Record<string, ComponentType> = { Sa: FlameIcon };

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

// Значок меню — своя кнопка Button у левого нижнего края круга, как значок у аватара Telegram (референс владельца
// 2026-10-29, со стороны меню): у круга и меню разные действия и имена. Вид — стекло кнопок над картой (COLUMN_BUTTON),
// иконка цветом текста. Видимая часть 16 px наполовину за краем круга: поле столбца для неё — pl-2.5 в LayerSwitcher.
// Зона нажатия (after) на 4 px шире: вниз она не доходит до следующего круга (gap-y-2)
const MENU_BADGE = cn(
    COLUMN_BUTTON,
    'absolute -bottom-0.5 -left-1.5 size-4 text-foreground after:absolute after:-inset-1',
);

// Пункты меню группы: нет слоя, снятого в Configure layers (галочка слоя группы по умолчанию стоит, listedByDefault),
// кроме того, что сейчас на карте, и первого слоя группы — это сам круг
function menuItems(
    group: QuickLayerGroup,
    layers: ReadonlyMap<string, LayerDef>,
    settings: LayerSettings,
    current: string | undefined,
): LayerDef[] {
    return group.codes.flatMap((code) => {
        const layer = layers.get(code);
        const shown = layer && (code === group.codes[0] || code === current || isListed(layer, settings));
        return shown ? [layer] : [];
    });
}

interface QuickMenuProps {
    group: QuickLayerGroup;
    // круг: меню встаёт верхом по нему, а не по значку
    anchor: RefObject<HTMLDivElement | null>;
    items: LayerDef[];
    current: string | undefined;
    onSelect(code: string): void;
}

function QuickMenu({ group, anchor, items, current, onSelect }: QuickMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className={MENU_BADGE}
                        aria-label={group.name}
                        title={group.name}
                    />
                }
            >
                <ChevronDownIcon className="size-2.5 stroke-3" />
            </DropdownMenuTrigger>
            {/* слева от круга: столбец у правого края, как All layers */}
            <DropdownMenuContent side="left" align="start" anchor={anchor} className="w-auto" aria-label={group.name}>
                {/* '' — в группе ничего не включено: отметки нет ни у одного пункта */}
                <DropdownMenuRadioGroup value={current ?? ''} onValueChange={(code) => onSelect(String(code))}>
                    {items.map((layer) => (
                        // RadioItem Base UI по умолчанию меню не закрывает
                        <DropdownMenuRadioItem key={layer.code} value={layer.code} closeOnClick>
                            {layer.title}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Три круга — всегда одни и те же типы QUICK_BASE_GROUPS (владелец 2026-10-28), даже если подложка круга скрыта в
// Configure layers: это функция столбца, как QuickDated. Подписей нет: превью сняты по типу и различаются картинкой.
// Круг — тип, а не подложка (владелец 2026-10-29, design quick-layer-menus): картинка — первой подложки группы, отмечен
// при любой подложке группы, нажатие — последняя выбранная в группе (quickTarget)
export function QuickBases() {
    return QUICK_BASE_GROUPS.map((group) => <QuickBase key={group.codes[0]} group={group} />);
}

function QuickBase({ group }: { group: QuickLayerGroup }) {
    const layers = useAppStore((state) => state.layers);
    const settings = useAppStore((state) => state.settings);
    const selected = useAppStore((state) => state.selection.base);
    const selectBase = useAppStore((state) => state.selectBase);
    const circle = useRef<HTMLDivElement>(null);
    const main = layers.get(group.codes[0]);
    if (!main) {
        return null;
    }
    const current = group.codes.includes(selected) ? selected : undefined;
    const items = menuItems(group, layers, settings, current);
    const target = quickTarget(
        group,
        settings.quickLayers,
        current,
        items.map((layer) => layer.code),
    );
    const title = layers.get(target)?.title ?? main.title;
    return (
        <div ref={circle} className="relative">
            <Button
                variant="ghost"
                size="icon-lg"
                className={cn(
                    COLUMN_BUTTON,
                    'overflow-hidden p-0',
                    // outline-solid: у Button outline-none, cn заменяет его только тем же свойством
                    current && 'outline-solid outline-2 outline-primary outline-offset-2',
                )}
                aria-label={title}
                title={title}
                aria-pressed={current !== undefined}
                onClick={() => selectBase(target)}
            >
                {/* без указателя: картинку иначе тащит мышь, и click не доходит до кнопки */}
                <img
                    src={thumbnailOf(main.code)}
                    alt=""
                    draggable={false}
                    className="pointer-events-none size-full object-cover"
                />
            </Button>
            <QuickMenu group={group} anchor={circle} items={items} current={current} onSelect={selectBase} />
        </div>
    );
}

// Кнопка оверлея — как круг подложки (design quick-layer-menus): включает слой группы, выбранный последним, и выключает
// группу, меню под значком ставит на карту другой слой группы вместо прежнего. Других мест у слоёв группы нет (в All
// layers их нет, design custom-bases-in-list), поэтому кнопка есть всегда, как круги
export function QuickOverlays() {
    return QUICK_OVERLAY_GROUPS.map((group) => <QuickOverlay key={group.codes[0]} group={group} />);
}

function QuickOverlay({ group }: { group: QuickLayerGroup }) {
    const layers = useAppStore((state) => state.layers);
    const settings = useAppStore((state) => state.settings);
    const enabled = useAppStore((state) => state.selection.overlays);
    const setQuickOverlay = useAppStore((state) => state.setQuickOverlay);
    const circle = useRef<HTMLDivElement>(null);
    const main = layers.get(group.codes[0]);
    const Icon = OVERLAY_ICONS[group.codes[0]];
    if (!main || !Icon) {
        return null;
    }
    const current = group.codes.find((code) => enabled.includes(code));
    const items = menuItems(group, layers, settings, current);
    const target = quickTarget(
        group,
        settings.quickLayers,
        current,
        items.map((layer) => layer.code),
    );
    const title = layers.get(target)?.title ?? main.title;
    return (
        <div ref={circle} className="relative">
            <Button
                variant="ghost"
                size="icon-lg"
                className={cn(COLUMN_BUTTON, current && PRESSED)}
                aria-label={title}
                title={title}
                aria-pressed={current !== undefined}
                onClick={() => setQuickOverlay(group, current ? null : target)}
            >
                <Icon />
            </Button>
            <QuickMenu
                group={group}
                anchor={circle}
                items={items}
                current={current}
                onSelect={(code) => setQuickOverlay(group, code)}
            />
        </div>
    );
}

// Снимки по датам — своей кнопкой под превью (владелец 2026-10-12, design quick-dated-imagery): нажатие выбирает их,
// повторное возвращает подложку, выбранную до них, а без неё (ссылка сразу с l=Hls) — подложку по умолчанию. Кнопка
// есть, даже если слой скрыт в Configure layers: это функция, а не строка списка
export function QuickDated() {
    const layers = useAppStore((state) => state.layers);
    const selected = useAppStore((state) => state.selection.base);
    // после отката Tracestrack на OSM вернуться — к Tracestrack: откат не выбор и в память кругов попадать не должен
    const chosen = useAppStore((state) => savedSelection(state).base);
    const selectBase = useAppStore((state) => state.selectBase);
    const lastBase = useRef<string | null>(null);
    const dated = [...layers.values()].find((layer) => layer.dated);
    const active = dated !== undefined && selected === dated.code;
    useEffect(() => {
        if (!layers.get(selected)?.dated) {
            lastBase.current = chosen;
        }
    }, [layers, selected, chosen]);
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
