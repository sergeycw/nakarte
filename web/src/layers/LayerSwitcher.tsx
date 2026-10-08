import { LayersIcon, PencilIcon, PlusIcon, Settings2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppStore } from '@/state/context';
import { ConfigureLayersDialog } from './ConfigureLayersDialog';
import { CustomLayerDialog } from './CustomLayerDialog';
import type { LayerDef } from './catalog';
import { isCustomLayerCode } from './custom';
import { hotkeyOf, isListed } from './settings';
import { useHotkeysEnabled, useLayerHotkeys } from './useLayerHotkeys';

// Переключатель слоёв справа сверху (design add-web-map-layers, «Переключатель»): свёрнут в кнопку на всех
// экранах — развёрнутый список старого клиента на телефоне закрывал пол-экрана. Подложки — радиокнопками,
// оверлеи — чекбоксами, порядок — порядок наложения каталога.

function LayerHint({ layer }: { layer: LayerDef }) {
    if (layer.minZoom === undefined) {
        return null;
    }
    // зум — в единицах старого клиента (Leaflet), как подпись «zoom ≥ 12» у его обзора покрытия
    return <span className="text-muted-foreground text-xs">zoom ≥ {layer.minZoom + 1}</span>;
}

function Hotkey({ value }: { value: string | null }) {
    if (!value) {
        return null;
    }
    return (
        <kbd className="ml-auto rounded border border-border px-1 font-mono text-muted-foreground text-xs">{value}</kbd>
    );
}

export function LayerSwitcher() {
    const layers = useAppStore((state) => state.layers);
    const settings = useAppStore((state) => state.settings);
    const selection = useAppStore((state) => state.selection);
    const selectBase = useAppStore((state) => state.selectBase);
    const toggleOverlay = useAppStore((state) => state.toggleOverlay);
    const hotkeysEnabled = useHotkeysEnabled();
    const [open, setOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    // null — диалог закрыт, '' — новый слой, код — правка своего слоя
    const [customCode, setCustomCode] = useState<string | null>(null);
    useLayerHotkeys(hotkeysEnabled && !configOpen && customCode === null);

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
                {hotkeysEnabled && <Hotkey value={hotkeyOf(layer, settings)} />}
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
        <div className="absolute top-3 right-3 z-10">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    render={<Button variant="outline" size="icon-lg" aria-label="Layers" data-testid="layers-button" />}
                >
                    <LayersIcon />
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    className="max-h-[calc(100dvh-5rem)] w-72 overflow-y-auto"
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
            <ConfigureLayersDialog open={configOpen} onOpenChange={setConfigOpen} hotkeysEnabled={hotkeysEnabled} />
            {customCode !== null && <CustomLayerDialog code={customCode || null} onClose={() => setCustomCode(null)} />}
        </div>
    );
}
