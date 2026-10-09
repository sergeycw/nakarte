import { CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/state/context';
import { useTrackActions } from './actions-context';
import { TRACK_COLORS } from './model';

// Панель режима точек трека (design add-web-line-tools, «Точки трека»): постановка кликами или перенос точки. Стоит там
// же, где панель редактирования линии (снизу по центру): оба режима не бывают одновременно.
export function PointPanel() {
    const actions = useTrackActions();
    const tool = useAppStore((state) => state.pointTool);
    const track = useAppStore((state) => state.tracks.find((item) => item.id === state.pointTool?.trackId));
    if (!tool || !track) {
        return null;
    }
    const adding = tool.kind === 'add';
    return (
        <Card
            size="sm"
            className="pointer-events-auto absolute bottom-[calc(var(--bottom-inset)+2rem)] left-1/2 z-10 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-row items-center gap-2 px-3 py-2"
            data-testid="point-panel"
        >
            <span
                className="block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: TRACK_COLORS[track.color] }}
            />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{track.name}</div>
                <div className="truncate text-muted-foreground text-xs">
                    {adding ? 'Click map to add points' : `Click map to move ${tool.point.name || 'the point'}`}
                </div>
            </div>
            <Button size="sm" variant={adding ? 'default' : 'outline'} onClick={actions.stopPointTool}>
                {adding ? <CheckIcon /> : <XIcon />}
                {adding ? 'Done' : 'Cancel'}
            </Button>
        </Card>
    );
}
