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
import type { LayerDef } from './catalog';
import { isCustomLayerCode } from './custom';
import { COLUMN_BUTTON, QuickBases, QuickOverlays } from './QuickLayers';
import { isListed } from './settings';

// Переключатель слоёв справа сверху: столбец быстрых слоёв — превью подложек и переключатели оверлеев (QuickLayers,
// design layer-thumbnails), под ними кнопка All layers с полным списком (design add-web-map-layers, «Переключатель»:
// развёрнутый список старого клиента на телефоне закрывал пол-экрана). В полном списке подложки — радиокнопками,
// оверлеи — чекбоксами, порядок — порядок наложения каталога. Столбец — контрол MapLibre (ControlPortal): рендерится
// внутри BaseMap до MapButtons, и кнопки карты встают под ним.

function LayerHint({ layer }: { layer: LayerDef }) {
    if (layer.minZoom === undefined) {
        return null;
    }
    // зум — в единицах старого клиента (Leaflet), как подпись «zoom ≥ 12» у его обзора покрытия
    return <span className="text-muted-foreground text-xs">zoom ≥ {layer.minZoom + 1}</span>;
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
    const bases = listed.filter((layer) => !layer.isOverlay);
    const overlays = listed.filter((layer) => layer.isOverlay);

    function row(layer: LayerDef) {
        const text = (
            <>
                <span className="flex flex-col">
                    <span>{layer.title}</span>
                    <LayerHint layer={layer} />
                </span>
            </>
        );
        const labelClass = 'flex min-h-7 flex-1 cursor-pointer items-center gap-2';
        return (
            <div key={layer.code} className="flex items-center gap-1">
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
                {/* влево от столбца, а не вниз поверх Street View и зума */}
                <PopoverContent
                    side="left"
                    align="start"
                    className="max-h-[calc(100dvh-1.5rem)] w-72 overflow-y-auto"
                    data-testid="layer-switcher"
                >
                    <RadioGroup
                        aria-label="Base layer"
                        value={selection.base}
                        onValueChange={(code) => selectBase(String(code))}
                        className="gap-0.5"
                    >
                        {bases.map(row)}
                    </RadioGroup>
                    {overlays.length > 0 && (
                        <fieldset className="flex flex-col gap-0.5 border-border border-t pt-2">
                            <legend className="sr-only">Overlays</legend>
                            {overlays.map(row)}
                        </fieldset>
                    )}
                    <div className="flex flex-col gap-1 border-border border-t pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start"
                            onClick={() => {
                                setOpen(false);
                                setConfigOpen(true);
                            }}
                        >
                            <Settings2Icon /> Configure layers
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start"
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
