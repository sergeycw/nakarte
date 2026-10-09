import { CheckIcon, Redo2Icon, Undo2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/state/context';
import { TRACK_COLORS } from '@/tracks/model';
import { useRouteEditing } from './editing-context';

// Панель редактирования линии (решение владельца 2026-10-09): плашка снизу по центру карты, пока линия редактируется, —
// не спорит со списком треков слева, слоями справа сверху и атрибуцией справа снизу. Кнопки Undo и Redo повторяют
// хоткеи, Done нужен телефону, где нет Escape.
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
        <Card
            size="sm"
            className="pointer-events-auto absolute bottom-[calc(var(--bottom-inset)+2rem)] left-1/2 z-10 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-row items-center gap-2 px-3 py-2"
            data-testid="edit-panel"
        >
            <span
                className="block h-1.5 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: TRACK_COLORS[track.color] }}
            />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{track.name}</div>
                <div className="truncate text-muted-foreground text-xs">{hint}</div>
            </div>
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
        </Card>
    );
}
