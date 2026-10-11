import { CheckIcon, Redo2Icon, Share2Icon, Undo2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/state/context';
import { ColorPicker } from '@/tracks/ColorPicker';
import { formatLength, tracksLength } from '@/tracks/geometry';
import { TrackExportItems } from '@/tracks/TrackExportItems';
import { useRouteEditing } from './editing-context';
import { RoutingButton } from './RoutingButton';
import { TrackNameInput } from './TrackNameInput';

// Редактор линии в верхней строке вместо поиска (макет 4a, design polish-web-ui; раньше — плашка снизу по центру,
// решение владельца 2026-10-09): палитра цвета, название полем и длина трека, активность прокладки, Undo, Redo,
// «Share track», галочка «Finish editing» (имя, цвет и экспорт без выхода из правки — design editor-name-share и
// editor-row-cleanup; уже 640 px Cancel и активность — только иконкой). Галочка нужна телефону, где нет Escape.
// Подсказка выбора Join и Shortcut — не здесь, а у точки на карте, как в макете (ToolHintOnMap, design
// editor-hint-at-point).
export function EditPanel() {
    const editing = useRouteEditing();
    const edit = useAppStore((state) => state.routeEdit);
    const track = useAppStore((state) => state.tracks.find((item) => item.id === state.routeEdit?.trackId));
    const tool = useAppStore((state) => state.lineTool);
    if (!edit || !track) {
        return null;
    }
    return (
        // data-drawing — режим рисования для тестов: раньше его видели по тексту подсказки
        <div className="w-full" data-testid="edit-panel" data-drawing={edit.drawing || undefined}>
            <div className="glass pointer-events-auto flex h-11 w-full items-center gap-1 rounded-xl px-2">
                <ColorPicker track={track} />
                <TrackNameInput key={track.id} track={track} />
                {/* длина трека, пока рисуешь: кнопки списка треков в верхней строке в это время нет */}
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums" data-testid="edit-length">
                    {formatLength(tracksLength(track.segments))}
                </span>
                <RoutingButton labeled />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Undo"
                    title="Undo (Cmd/Ctrl+Z)"
                    // выбор Join и Shortcut на карте (design add-web-line-tools): правка линии сдвинула бы номер точки,
                    // от которой он идёт
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
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="Share track" title="Share track" />}
                    >
                        <Share2Icon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-auto">
                        <TrackExportItems track={track} />
                    </DropdownMenuContent>
                </DropdownMenu>
                {tool ? (
                    <Button size="sm" variant="outline" aria-label="Cancel" onClick={editing.cancelTool}>
                        <XIcon />
                        <span className="max-sm:hidden">Cancel</span>
                    </Button>
                ) : (
                    // заливка --primary, а не стекло круглых кнопок над картой: стекло на стеклянной строке не читается
                    <Button
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Finish editing"
                        title="Finish editing"
                        onClick={editing.stop}
                    >
                        <CheckIcon />
                    </Button>
                )}
            </div>
        </div>
    );
}
