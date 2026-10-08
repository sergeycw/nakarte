import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppStore } from '@/state/context';
import { GROUPS, type LayerDef } from './catalog';
import { isCustomLayerCode } from './custom';
import { hotkeyOf, isListed } from './settings';
import { hotkeyFromEvent } from './useLayerHotkeys';

// Настройка списка слоёв — как LayersConfigDialog старого клиента (leaflet.control.layers.configure): все слои по
// группам с галочкой «в списке» и хоткеем; Reset — умолчания каталога, Cancel — без изменений, Ok — сохранить.

interface Draft {
    listed: Record<string, boolean>;
    hotkeys: Record<string, string | null>;
}

interface ConfigureLayersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hotkeysEnabled: boolean;
}

function HotkeyInput({
    layer,
    value,
    onChange,
    error,
}: {
    layer: LayerDef;
    value: string | null;
    onChange: (key: string | null) => void;
    error: string | null;
}) {
    return (
        <span className="flex flex-col items-end">
            <button
                type="button"
                className="h-6 min-w-8 rounded border border-border px-1 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`Hotkey for ${layer.title}`}
                title={value ? 'Change or remove hotkey' : 'Set hotkey'}
                onKeyDown={(event) => {
                    // не даём хоткею слоя сработать, пока его назначают (keyupBubble: false у старого диалога)
                    event.stopPropagation();
                    if (['Delete', 'Backspace', 'Space'].includes(event.code)) {
                        event.preventDefault();
                        onChange(null);
                        return;
                    }
                    if (event.code === 'Enter' || event.code === 'Escape' || event.code === 'Tab') {
                        return;
                    }
                    const key = hotkeyFromEvent(event.nativeEvent);
                    if (key) {
                        event.preventDefault();
                        onChange(key);
                    }
                }}
            >
                {value ?? '—'}
            </button>
            {error && <span className="text-destructive text-xs">{error}</span>}
        </span>
    );
}

export function ConfigureLayersDialog({ open, onOpenChange, hotkeysEnabled }: ConfigureLayersDialogProps) {
    const layers = useAppStore((state) => state.layers);
    const settings = useAppStore((state) => state.settings);
    const updateSettings = useAppStore((state) => state.updateSettings);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState<{ code: string; text: string } | null>(null);

    const all = [...layers.values()];
    const current: Draft =
        draft ??
        ({
            listed: Object.fromEntries(all.map((layer) => [layer.code, isListed(layer, settings)])),
            hotkeys: Object.fromEntries(all.map((layer) => [layer.code, hotkeyOf(layer, settings)])),
        } satisfies Draft);

    function close() {
        setDraft(null);
        setError(null);
        onOpenChange(false);
    }

    function setHotkey(layer: LayerDef, key: string | null) {
        const owner = key ? all.find((item) => item.code !== layer.code && current.hotkeys[item.code] === key) : null;
        if (owner) {
            setError({ code: layer.code, text: `Hotkey "${key}" is already used by layer "${owner.title}"` });
            return;
        }
        setError(null);
        setDraft({ ...current, hotkeys: { ...current.hotkeys, [layer.code]: key } });
    }

    const groups: [string, LayerDef[]][] = [...GROUPS, 'Custom layers'].map((group) => [
        group,
        all
            .filter((layer) => (isCustomLayerCode(layer.code) ? 'Custom layers' : layer.group) === group)
            .sort((a, b) => a.order - b.order),
    ]);

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_1fr_auto] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Configure layers</DialogTitle>
                </DialogHeader>
                <div className="-mx-4 overflow-y-auto px-4">
                    {groups
                        .filter(([, items]) => items.length > 0)
                        .map(([group, items]) => (
                            <section key={group} className="pb-3">
                                <h3 className="pb-1 font-medium text-muted-foreground text-xs uppercase">{group}</h3>
                                {items.map((layer) => (
                                    <div key={layer.code} className="flex min-h-7 items-center gap-2">
                                        <label className="flex flex-1 cursor-pointer items-center gap-2">
                                            <Checkbox
                                                checked={current.listed[layer.code]}
                                                onCheckedChange={(checked) =>
                                                    setDraft({
                                                        ...current,
                                                        listed: { ...current.listed, [layer.code]: checked },
                                                    })
                                                }
                                            />
                                            {layer.title}
                                        </label>
                                        {hotkeysEnabled && (
                                            <HotkeyInput
                                                layer={layer}
                                                value={current.hotkeys[layer.code]}
                                                onChange={(key) => setHotkey(layer, key)}
                                                error={error?.code === layer.code ? error.text : null}
                                            />
                                        )}
                                    </div>
                                ))}
                            </section>
                        ))}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            // умолчания каталога; свои слои не умолчание — скрываются, как Reset старого диалога
                            setError(null);
                            setDraft({
                                listed: Object.fromEntries(all.map((layer) => [layer.code, layer.isDefault])),
                                hotkeys: Object.fromEntries(all.map((layer) => [layer.code, layer.hotkey])),
                            });
                        }}
                    >
                        Reset
                    </Button>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            updateSettings({ listed: current.listed, hotkeys: current.hotkeys });
                            close();
                        }}
                    >
                        Ok
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
