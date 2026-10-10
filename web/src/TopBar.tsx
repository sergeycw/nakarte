import { PlusIcon, RulerIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROUND_BUTTON } from '@/components/round-button';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { cn } from '@/lib/utils';
import { EditPanel } from '@/routing/EditPanel';
import { useRouteEditing } from '@/routing/editing-context';
import { SearchBox } from '@/search/SearchBox';
import { useAppStore } from '@/state/context';
import { PointPanel } from '@/tracks/PointPanel';
import { TrackList, TracksButton } from '@/tracks/TrackList';

// «Measure distance»: трек Ruler с отметками расстояния и сразу рисование (control-ruler.js старого)
function RulerButton() {
    const editing = useRouteEditing();
    return (
        <Button
            variant="ghost"
            size="icon-lg"
            className={ROUND_BUTTON}
            aria-label="Measure distance"
            title="Measure distance"
            onClick={() => editing.newTrack('Ruler', { measureTicksShown: true })}
        >
            <RulerIcon />
        </Button>
    );
}

// Зона маршрута слева сверху (три зоны, design layout-three-zones): капсула поиска, круглые Tracks, New и линейка. Пока
// линия редактируется или ставятся точки трека, строка становится их панелью. Список треков — панелью под строкой: открывается
// кнопкой Tracks, закрывается ею же или нажатием на карту (холст MapLibre), а не любым кликом мимо: меню и диалоги
// списка живут в порталах вне панели.
export function TopBar({ fetch }: { fetch: typeof window.fetch }) {
    const editing = useRouteEditing();
    const lineEdited = useAppStore((state) => state.routeEdit !== null);
    const pointMode = useAppStore((state) => state.pointTool !== null);
    const [tracksOpen, setTracksOpen] = useState(false);

    useEffect(() => {
        if (!tracksOpen) {
            return;
        }
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Element && event.target.closest('.maplibregl-canvas')) {
                setTracksOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [tracksOpen]);

    let bar = (
        // каждая кнопка — своё стекло, зазоры между ними — карта (design layout-three-zones, «Зоны и компоненты»)
        <div className="flex w-full items-center gap-1">
            {/* relative z-20: у стекла свой контекст наложения (backdrop-filter), и без него открытый список под
                строкой рисовался бы поверх результатов поиска */}
            <div
                className="glass pointer-events-auto relative z-20 flex h-9 min-w-0 flex-1 items-center rounded-full"
                data-testid="search-bar"
            >
                <SearchBox sources={{ fetch, corsProxyUrl: config.corsProxyUrl }} />
            </div>
            <TracksButton open={tracksOpen} onToggle={() => setTracksOpen(!tracksOpen)} />
            <Button
                variant="ghost"
                size="icon-lg"
                // акцент основной кнопки (макет 4a) — цветом иконки: кнопка остаётся стеклянной, как соседние
                className={cn(ROUND_BUTTON, 'text-primary hover:text-primary')}
                aria-label="New track"
                title="New track"
                onClick={() => editing.newTrack('')}
            >
                <PlusIcon />
            </Button>
            <RulerButton />
        </div>
    );
    if (lineEdited) {
        bar = <EditPanel />;
    } else if (pointMode) {
        bar = <PointPanel />;
    }

    return (
        // справа место под столбец кнопок карты (4.5rem = поля + кнопка), снизу — над кнопкой профиля и нижними
        // панелями (--bottom-inset); клики между панелями уходят карте
        <div
            className="pointer-events-none absolute top-3 left-3 z-10 flex max-h-[calc(100dvh-5rem-var(--bottom-inset))] w-[min(30rem,calc(100vw-4.5rem))] flex-col items-start gap-2"
            data-testid="top-bar"
        >
            {bar}
            {tracksOpen && <TrackList />}
        </div>
    );
}
