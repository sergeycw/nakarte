import { PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { EditPanel } from '@/routing/EditPanel';
import { useRouteEditing } from '@/routing/editing-context';
import { SearchBox } from '@/search/SearchBox';
import { useAppStore } from '@/state/context';
import { PointPanel } from '@/tracks/PointPanel';
import { TrackList, TracksButton } from '@/tracks/TrackList';

// Верхняя строка слева сверху (макет Claude Design 4a, design polish-web-ui): поиск | Tracks N | + New. Пока линия
// редактируется или ставятся точки трека, строка становится их панелью. Список треков — панелью под строкой: открывается
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
        // relative z-20: у стекла свой контекст наложения (backdrop-filter), и без него открытый список под строкой
        // рисовался бы поверх результатов поиска
        <div className="glass pointer-events-auto relative z-20 flex h-11 w-full items-center gap-0.5 rounded-xl p-1">
            <SearchBox sources={{ fetch, corsProxyUrl: config.corsProxyUrl }} />
            <TracksButton open={tracksOpen} onToggle={() => setTracksOpen(!tracksOpen)} />
            <Button
                className="h-9 shrink-0 px-3"
                aria-label="New track"
                title="New track"
                onClick={() => editing.newTrack('')}
            >
                <PlusIcon />
                New
            </Button>
        </div>
    );
    if (lineEdited) {
        bar = <EditPanel />;
    } else if (pointMode) {
        bar = <PointPanel />;
    }

    return (
        // справа место под столбец кнопок карты (4.5rem = поля + кнопка), снизу — над строкой кнопок и нижними
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
