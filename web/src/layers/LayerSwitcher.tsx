import { cn } from 'cn';
import { ChevronRightIcon, LayersIcon, PencilIcon, PlusIcon, Settings2Icon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ControlPortal } from '@/map/control-portal';
import { useAppStore } from '@/state/context';
import { ConfigureLayersDialog } from './ConfigureLayersDialog';
import { CustomLayerDialog } from './CustomLayerDialog';
import { GROUPS, type LayerDef } from './catalog';
import { isCustomLayerCode } from './custom';
import { COLUMN_BUTTON, QuickBases, QuickOverlays } from './QuickLayers';
import { isListed } from './settings';

// Переключатель слоёв справа сверху: столбец быстрых слоёв — превью подложек и переключатели оверлеев (QuickLayers,
// design layer-thumbnails), под ними кнопка All layers с полным списком (design add-web-map-layers, «Переключатель»:
// развёрнутый список старого клиента на телефоне закрывал пол-экрана). В полном списке подложки — радиокнопками,
// оверлеи — чекбоксами, порядок — порядок наложения каталога. Столбец — контрол MapLibre (ControlPortal): рендерится
// внутри BaseMap до MapButtons, и кнопки карты встают под ним.
//
// Полный список компактный (design compact-all-layers): подложки раскрыты всегда, оверлеи — свёрнутыми секциями.
// Секция «Overlays» — оверлеи групп каталога, где есть слой по умолчанию (Default layers, Miscellaneous, Routes and
// traces); группы без слоёв по умолчанию (Topo maps, Norway, свои слои) — редкие, у каждой своя секция.

const OVERLAYS_SECTION = 'Overlays';
// своя группа слоёв по URL — как в custom.ts и ConfigureLayersDialog
const SECTION_ORDER = [OVERLAYS_SECTION, ...GROUPS, 'Custom layers'];

function overlaySections(overlays: LayerDef[], layers: ReadonlyMap<string, LayerDef>): [string, LayerDef[]][] {
    const common = new Set([...layers.values()].filter((layer) => layer.isDefault).map((layer) => layer.group));
    const sectionOf = (layer: LayerDef) => (common.has(layer.group) ? OVERLAYS_SECTION : layer.group);
    // группа не из GROUPS (новая в каталоге) — секцией в конце, а не пропадает из списка
    const names = new Set([...SECTION_ORDER, ...overlays.map(sectionOf)]);
    return [...names].flatMap((name): [string, LayerDef[]][] => {
        const items = overlays.filter((layer) => sectionOf(layer) === name);
        return items.length > 0 ? [[name, items]] : [];
    });
}

function LayerHint({ layer }: { layer: LayerDef }) {
    if (layer.minZoom === undefined) {
        return null;
    }
    // зум — в единицах старого клиента (Leaflet), как подпись «zoom ≥ 12» у его обзора покрытия
    return <span className="whitespace-nowrap text-muted-foreground text-xs">zoom ≥ {layer.minZoom + 1}</span>;
}

export function LayerSwitcher() {
    const layers = useAppStore((state) => state.layers);
    const settings = useAppStore((state) => state.settings);
    const selection = useAppStore((state) => state.selection);
    const selectBase = useAppStore((state) => state.selectBase);
    const toggleOverlay = useAppStore((state) => state.toggleOverlay);
    const [open, setOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    // null — диалог закрыт, '' — новый слой, код — правка своего слоя
    const [customCode, setCustomCode] = useState<string | null>(null);
    // раскрытость секций оверлеев, пока страница открыта; без выбора пользователя раскрыта секция с включённым
    // оверлеем: видно, что включено, и выключить можно сразу. Флажок в секции закрепляет её раскрытой: иначе снятие
    // последнего включённого сворачивало бы секцию под курсором, а фокус с флажка терялся
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const sectionsId = useId();

    const listed = useMemo(() => {
        const visible = [...layers.values()].filter(
            (layer) =>
                isListed(layer, settings) || selection.base === layer.code || selection.overlays.includes(layer.code),
        );
        return visible.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
    }, [layers, settings, selection]);
    const bases = listed.filter((layer) => !layer.isOverlay);
    const overlays = listed.filter((layer) => layer.isOverlay);
    const sections = overlaySections(overlays, layers);

    // section — секция оверлея; у подложек её нет
    function row(layer: LayerDef, section?: string) {
        const text = (
            <span>
                {layer.title} <LayerHint layer={layer} />
            </span>
        );
        const labelClass = 'flex min-h-6 flex-1 cursor-pointer items-center gap-2 leading-tight';
        return (
            <div key={layer.code} className="flex items-center gap-1 px-1">
                {layer.isOverlay ? (
                    <label className={labelClass} data-layer={layer.code}>
                        <Checkbox
                            checked={selection.overlays.includes(layer.code)}
                            onCheckedChange={() => {
                                toggleOverlay(layer.code);
                                if (section !== undefined) {
                                    setExpanded((current) => ({ ...current, [section]: true }));
                                }
                            }}
                        />
                        {text}
                    </label>
                ) : (
                    <label className={labelClass} data-layer={layer.code}>
                        <RadioGroupItem value={layer.code} />
                        {text}
                    </label>
                )}
                {isCustomLayerCode(layer.code) && (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit layer ${layer.title}`}
                        onClick={() => {
                            setOpen(false);
                            setCustomCode(layer.code);
                        }}
                    >
                        <PencilIcon />
                    </Button>
                )}
            </div>
        );
    }

    function section([name, items]: [string, LayerDef[]], index: number) {
        const enabled = items.filter((layer) => selection.overlays.includes(layer.code)).length;
        const isOpen = expanded[name] ?? enabled > 0;
        const panelId = `${sectionsId}-${index}`;
        return (
            <div key={name} className="border-border border-t pt-0.5">
                <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpanded((current) => ({ ...current, [name]: !isOpen }))}
                    className="flex min-h-6 w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left font-medium text-muted-foreground text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                    <ChevronRightIcon className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                    {name}
                    {enabled > 0 && <span className="ml-auto pl-2 tabular-nums">{enabled} on</span>}
                </button>
                {/* свёрнутая секция остаётся в разметке невидимой и задаёт ширину панели: без неё панель при раскрытии
                    становилась шире и наезжала на столбец кнопок (design compact-all-layers). invisible уже убирает
                    строки из фокуса и дерева доступности, inert — на случай, если видимость перебьют стили */}
                <fieldset id={panelId} inert={!isOpen} className={cn(!isOpen && 'invisible h-0 overflow-hidden')}>
                    <legend className="sr-only">{name}</legend>
                    {items.map((layer) => row(layer, name))}
                </fieldset>
            </div>
        );
    }

    return (
        // между кругами — карта: контейнер прозрачен для указателя, кнопки (COLUMN_BUTTON) — нет. pointer-events с !:
        // CSS MapLibre вне @layer задаёт .maplibregl-ctrl pointer-events: auto
        <ControlPortal className="pointer-events-none! flex flex-col items-center gap-2" first>
            {/* быстрые слои уступают место кнопкам карты над нижними панелями: что не влезает по высоте, уходит во
                второй столбец обёртки и обрезается (flex-wrap + overflow-hidden), и Street View, зум и геолокация не
                прячутся под профиль и панораму. 15rem — All layers, Street View, зум, геолокация с отступами; p-1 —
                место под обводку выбранной подложки */}
            <fieldset className="-m-1 flex max-h-[calc(100dvh-var(--bottom-inset)-15rem)] w-11 flex-col flex-wrap items-center gap-2 overflow-hidden p-1">
                <legend className="sr-only">Quick layers</legend>
                {/* в столбце — только слои списка: скрытый, но включённый ссылкой — в All layers */}
                <QuickBases listed={bases.filter((layer) => isListed(layer, settings))} all={bases} />
                <QuickOverlays overlays={overlays.filter((layer) => isListed(layer, settings))} />
            </fieldset>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon-lg"
                            className={COLUMN_BUTTON}
                            aria-label="All layers"
                            title="All layers"
                            data-testid="layers-button"
                        />
                    }
                >
                    <LayersIcon />
                </PopoverTrigger>
                {/* влево от столбца, а не вниз поверх Street View и зума. Ширина — по самой длинной строке, но не шире
                    окна без столбца кнопок справа (4.5rem); высота — не больше места, которое отдаёт позиционер Base UI
                    (--available-height), остальное прокручивается */}
                <PopoverContent
                    side="left"
                    align="start"
                    className="max-h-(--available-height) w-max max-w-[min(20rem,calc(100vw-4.5rem))] gap-0.5 overflow-y-auto overscroll-contain p-1.5"
                    data-testid="layer-switcher"
                >
                    <RadioGroup
                        aria-label="Base layer"
                        value={selection.base}
                        onValueChange={(code) => selectBase(String(code))}
                        className="gap-0"
                    >
                        {bases.map((layer) => row(layer))}
                    </RadioGroup>
                    {sections.map(section)}
                    <div className="flex flex-col border-border border-t pt-0.5">
                        <Button
                            variant="ghost"
                            size="xs"
                            className="justify-start font-normal"
                            onClick={() => {
                                setOpen(false);
                                setConfigOpen(true);
                            }}
                        >
                            <Settings2Icon /> Configure layers
                        </Button>
                        <Button
                            variant="ghost"
                            size="xs"
                            className="justify-start font-normal"
                            onClick={() => {
                                setOpen(false);
                                setCustomCode('');
                            }}
                        >
                            <PlusIcon /> Add custom layer
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
            <ConfigureLayersDialog open={configOpen} onOpenChange={setConfigOpen} />
            {customCode !== null && <CustomLayerDialog code={customCode || null} onClose={() => setCustomCode(null)} />}
        </ControlPortal>
    );
}
