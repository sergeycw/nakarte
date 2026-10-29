import { LayersIcon, PencilIcon, PlusIcon, Settings2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { COLUMN_BUTTON, QuickBases, QuickDated, QuickOverlays } from './QuickLayers';
import { quickGroupOf } from './quick-layers';
import { isListed } from './settings';

// Переключатель слоёв справа сверху: столбец быстрых слоёв — круги подложек и кнопка хитмэпа с меню групп (QuickLayers,
// design layer-thumbnails, design quick-layer-menus), под ними кнопка All layers с полным списком (design add-web-map-layers, «Переключатель»:
// развёрнутый список старого клиента на телефоне закрывал пол-экрана). В полном списке свои подложки — радиокнопками
// (подложки каталога — в кругах столбца, design custom-bases-in-list), оверлеи — чекбоксами, порядок — порядок
// наложения каталога. Столбец — контрол MapLibre (ControlPortal): рендерится
// внутри BaseMap до MapButtons, и кнопки карты встают под ним.
//
// Оверлеи — секциями без сворачивания (design uniform-layer-menus; раньше свёрнутыми, design compact-all-layers): после
// custom-bases-in-list в панели почти одни оверлеи, и свёрнутая секция прятала весь список. Секция «Overlays» —
// оверлеи групп каталога, где есть слой по умолчанию (Default layers, Miscellaneous, Routes and traces); группы без
// слоёв по умолчанию (Topo maps, Norway, свои слои) — редкие, у каждой своя секция с заголовком.

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

    const listed = useMemo(() => {
        const visible = [...layers.values()].filter(
            (layer) =>
                isListed(layer, settings) || selection.base === layer.code || selection.overlays.includes(layer.code),
        );
        return visible.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
    }, [layers, settings, selection]);
    // подложки каталога выбирают круги столбца и их меню, снимки по датам — своя кнопка (QuickLayers): в списке только
    // свои подложки, у них нет группы и другого места (design custom-bases-in-list)
    const bases = listed.filter((layer) => !layer.isOverlay && isCustomLayerCode(layer.code));
    // хитмэпы Strava — только кнопка столбца с меню (владелец 2026-10-29, design custom-bases-in-list)
    const overlays = listed.filter((layer) => layer.isOverlay && !quickGroupOf(layer.code));
    const sections = overlaySections(overlays, layers);

    function row(layer: LayerDef) {
        const text = (
            <span>
                {layer.title} <LayerHint layer={layer} />
            </span>
        );
        // строка 24 px со шрифтом 14 px — как пункты меню (правило единообразия в AGENTS.md, design uniform-layer-menus)
        const labelClass = 'flex min-h-6 flex-1 cursor-pointer items-center gap-2';
        return (
            <div key={layer.code} className="flex items-center gap-1 px-1">
                {layer.isOverlay ? (
                    <label className={labelClass} data-layer={layer.code}>
                        <Checkbox
                            checked={selection.overlays.includes(layer.code)}
                            onCheckedChange={() => toggleOverlay(layer.code)}
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

    function section([name, items]: [string, LayerDef[]]) {
        return (
            // без своих подложек секция — первая в панели, линия над ней лишняя
            <fieldset key={name} className="border-border border-t pt-0.5 first:border-t-0 first:pt-0">
                {/* заголовок — как подпись DropdownMenuLabel: 12 px, приглушённый (правило единообразия в AGENTS.md) */}
                <legend className="float-left w-full px-1 py-1 font-medium text-muted-foreground text-xs">
                    {name}
                </legend>
                {items.map((layer) => row(layer))}
            </fieldset>
        );
    }

    return (
        // между кругами — карта: контейнер прозрачен для указателя, кнопки (COLUMN_BUTTON) — нет. pointer-events с !:
        // CSS MapLibre вне @layer задаёт .maplibregl-ctrl pointer-events: auto
        <ControlPortal className="pointer-events-none! flex flex-col items-center gap-2" first>
            {/* быстрые слои уступают место кнопкам карты над нижними панелями: что не влезает по высоте, уходит во
                второй столбец обёртки и обрезается (flex-wrap + overflow-hidden), и Street View, зум и геолокация не
                прячутся под профиль и панораму. 15rem — All layers, Street View, зум, геолокация с отступами. Поля
                съедены отрицательными отступами, и столбец остаётся шириной круга: py-1 и pr-1 — под обводку
                отмеченного круга, pl-2.5 — под значок меню у левого края круга с его зоной нажатия (QuickLayers).
                gap-x-4 уводит перенесённую часть целиком за обрезку: при gap-2 её значки и обводки торчали в правом
                поле и нажимались */}
            <fieldset className="-my-1 -mr-1 -ml-2.5 flex max-h-[calc(100dvh-var(--bottom-inset)-15rem)] w-12.5 flex-col flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden py-1 pr-1 pl-2.5">
                <legend className="sr-only">Quick layers</legend>
                {/* функции столбца, есть всегда: сверху кнопки с меню — три круга подложек и хитмэп, под ними снимки по
                    датам (владелец 2026-10-29, design custom-bases-in-list) */}
                <QuickBases />
                <QuickOverlays />
                <QuickDated />
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
                    {bases.length > 0 && (
                        <RadioGroup
                            aria-label="Base layer"
                            value={selection.base}
                            onValueChange={(code) => selectBase(String(code))}
                            className="gap-0"
                        >
                            {bases.map((layer) => row(layer))}
                        </RadioGroup>
                    )}
                    {sections.map(section)}
                    {/* первая в панели — без своих подложек и оверлеев в списке: линия над ней лишняя */}
                    <div className="flex flex-col border-border border-t pt-0.5 first:border-t-0 first:pt-0">
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
