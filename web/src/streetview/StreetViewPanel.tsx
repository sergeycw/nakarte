import { LoaderCircleIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppStore, useAppStoreApi } from '@/state/context';
import type { StreetViewViewer } from './api';
import { useStreetView } from './context';
import { UNAVAILABLE_MESSAGE } from './controller';

// Панель панорамы (design add-web-search-panoramas, «Панель панорамы»): снизу на всю ширину, над профилем высот
// (--profile-inset); панели редактора и точек, атрибуция и тосты — над ней по --bottom-inset (App). Окно создаётся при
// первом открытии и живёт, пока включён режим: закрытие прячет панель, выключение режима снимает её вместе с окном.

// с профилем высот панорама ниже: обе панели на телефоне 390×844 в полный рост оставили бы карте ≈ 100 px (скриншоты
// 2026-10-09)
export function panoramaHeight(withProfile: boolean): string {
    return withProfile ? 'min(30dvh, 20rem)' : 'min(45dvh, 28rem)';
}

function Viewer({ open }: { open: boolean }) {
    const store = useAppStoreApi();
    const streetView = useStreetView();
    const request = useAppStore((state) => state.streetView.request);
    const container = useRef<HTMLDivElement>(null);
    const [viewer, setViewer] = useState<StreetViewViewer | null>(null);
    const [started, setStarted] = useState(false);

    // окно — при первом открытии: API грузится только тогда
    useEffect(() => {
        if (open) {
            setStarted(true);
        }
    }, [open]);

    useEffect(() => {
        const element = container.current;
        if (!started || !element) {
            return;
        }
        let active = true;
        let created: StreetViewViewer | null = null;
        streetView.api
            .createViewer(element, {
                // закрытая панель не открывается снова от событий окна
                onChange: (view) => {
                    if (active && store.getState().streetView.pano) {
                        store.getState().setPano(view);
                    }
                },
            })
            .then(
                (instance) => {
                    created = instance;
                    if (active) {
                        setViewer(instance);
                    } else {
                        instance.destroy();
                    }
                },
                () => {
                    if (active) {
                        streetView.notify(UNAVAILABLE_MESSAGE, 'error');
                        streetView.close();
                        setStarted(false);
                    }
                },
            );
        return () => {
            active = false;
            created?.destroy();
            setViewer(null);
        };
    }, [started, streetView, store]);

    // запрос перейти — клик по карте или адрес
    useEffect(() => {
        if (viewer && request) {
            viewer.show(request.view);
        }
    }, [viewer, request]);

    useEffect(() => {
        const element = container.current;
        if (!viewer || !element) {
            return;
        }
        const observer = new ResizeObserver(() => viewer.resize());
        observer.observe(element);
        return () => observer.disconnect();
    }, [viewer]);

    return (
        <div className="relative min-h-0 flex-1">
            <div ref={container} className="absolute inset-0" data-testid="panorama-viewer" />
            {!viewer && (
                <LoaderCircleIcon
                    className="absolute inset-0 m-auto size-6 animate-spin text-muted-foreground"
                    aria-label="Loading Street View"
                />
            )}
        </div>
    );
}

export function StreetViewPanel() {
    const enabled = useAppStore((state) => state.streetView.enabled);
    const open = useAppStore((state) => state.streetView.pano !== null);
    const withProfile = useAppStore((state) => state.profile !== null);
    const streetView = useStreetView();
    if (!enabled) {
        return null;
    }
    return (
        <Card
            role="region"
            aria-label="Street View"
            size="sm"
            className="pointer-events-auto absolute inset-x-3 z-10 flex flex-col gap-0 py-0 data-[open=false]:hidden"
            style={{ height: panoramaHeight(withProfile), bottom: 'calc(var(--profile-inset) + 0.75rem)' }}
            data-open={open}
            data-testid="street-view-panel"
        >
            <div className="flex h-8 shrink-0 items-center justify-between px-3">
                <span className="font-medium text-sm">Street View</span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Close Street View"
                    onClick={() => streetView.close()}
                >
                    <XIcon />
                </Button>
            </div>
            <Viewer open={open} />
        </Card>
    );
}
