import { CheckIcon, Redo2Icon, Undo2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/state/context';
import { formatLength, tracksLength } from '@/tracks/geometry';
import { TRACK_COLORS } from '@/tracks/model';
import { useRouteEditing } from './editing-context';
import { RoutingButton } from './RoutingButton';

// Редактор линии в верхней строке вместо поиска (макет 4a, design polish-web-ui; раньше — плашка снизу по центру,
// решение владельца 2026-10-09): цвет, название и длина трека, активность прокладки, Undo, Redo, Done. Подсказка — строкой под
// ней, а не у последней точки на карте, как в макете: там она спорит с линией и пропадает за краем карты. Done нужен
// телефону, где нет Escape.
export function EditPanel() {
    const editing = useRouteEditing();
    const edit = useAppStore((state) => state.routeEdit);
    const track = useAppStore((state) => state.tracks.find((item) => item.id === state.routeEdit?.trackId));
    const tool = useAppStore((state) => state.lineTool);
    if (!edit || !track) {
        return null;
    }
    // выбор на карте для Join и Shortcut (design add-web-line-tools): подсказка, что кликнуть, Undo/Redo недоступны —
    // правка линии сдвинула бы номер точки, от которой идёт выбор
    let hint = edit.drawing ? 'Click map to add points' : 'Drag points, click line end to continue';
    if (tool?.kind === 'join') {
        hint = 'Click a track line to join it';
    } else if (tool?.kind === 'shortcut') {
        hint = 'Click the line where the shortcut ends';
    }
    return (
        <div className="flex w-full flex-col items-start gap-1.5" data-testid="edit-panel">
            <div className="glass pointer-events-auto flex h-11 w-full items-center gap-1 rounded-xl px-2">
                <span
                    className="block h-1.5 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: TRACK_COLORS[track.color] }}
                />
                <span className="min-w-0 flex-1 truncate px-1 font-medium text-sm" title={track.name}>
                    {track.name}
                </span>
                {/* длина трека, пока рисуешь: список треков в это время закрыт */}
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums" data-testid="edit-length">
                    {formatLength(tracksLength(track.segments))}
                </span>
                <RoutingButton labeled />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Undo"
                    title="Undo (Cmd/Ctrl+Z)"
                    disabled={!edit.canUndo || tool !== null}
                    onClick={editing.undo}
                >
                    <Undo2Icon />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Redo"
                    title="Redo (Cmd/Ctrl+Shift+Z)"
                    disabled={!edit.canRedo || tool !== null}
                    onClick={editing.redo}
                >
                    <Redo2Icon />
                </Button>
                {tool ? (
                    <Button size="sm" variant="outline" onClick={editing.cancelTool}>
                        <XIcon />
                        Cancel
                    </Button>
                ) : (
                    <Button size="sm" onClick={editing.stop}>
                        <CheckIcon />
                        Done
                    </Button>
                )}
            </div>
            <div className="glass pointer-events-auto max-w-full truncate rounded-lg px-2.5 py-1 text-muted-foreground text-xs">
                {hint}
            </div>
        </div>
    );
}
