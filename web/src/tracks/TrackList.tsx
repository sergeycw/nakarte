import {
    ChevronDownIcon,
    ChevronUpIcon,
    DownloadIcon,
    EllipsisIcon,
    EllipsisVerticalIcon,
    FolderOpenIcon,
    LoaderCircleIcon,
    PlusIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouteEditing } from '@/routing/editing-context';
import { RoutingButton } from '@/routing/RoutingButton';
import { useAppStore } from '@/state/context';
import { useTrackActions } from './actions-context';
import { formatLength, tracksLength } from './geometry';
import { TRACK_COLORS, type Track } from './model';
import { CopyFallbackDialog, RenameTrackDialog } from './TrackDialogs';

// Список треков слева под панелью с названием (design add-web-tracks, «Список треков»): строка ввода, меню списка,
// строки треков с меню трека. Тексты меню — старого клиента. Действия — createTrackActions (actions.ts).

function ColorPicker({ track }: { track: Track }) {
    const actions = useTrackActions();
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button variant="ghost" size="icon-xs" aria-label={`Color of ${track.name}`} className="shrink-0" />
                }
            >
                <span
                    className="block h-1.5 w-4 rounded-full"
                    style={{ backgroundColor: TRACK_COLORS[track.color] }}
                    data-color={track.color}
                />
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-auto flex-row gap-1 p-1.5">
                {TRACK_COLORS.map((color, index) => (
                    <Button
                        key={color}
                        variant={index === track.color ? 'outline' : 'ghost'}
                        size="icon-sm"
                        aria-label={`Color ${index + 1}`}
                        onClick={() => {
                            actions.setColor(track, index);
                            setOpen(false);
                        }}
                    >
                        <span className="block h-1.5 w-4 rounded-full" style={{ backgroundColor: color }} />
                    </Button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

function TrackRow({ track, onRename }: { track: Track; onRename: (track: Track) => void }) {
    const actions = useTrackActions();
    const editing = useRouteEditing();
    const edited = useAppStore((state) => state.routeEdit?.trackId === track.id);
    return (
        // редактируемый трек подсвечен (класс edit строки старого клиента)
        <li
            className={`-mx-1 flex min-h-8 items-center gap-1 rounded-md px-1 ${edited ? 'bg-muted' : ''}`}
            data-track={track.name}
            data-editing={edited || undefined}
        >
            <Checkbox
                aria-label={`Show ${track.name}`}
                checked={track.visible}
                onCheckedChange={(checked, details) =>
                    actions.setVisible(track, checked, (details.event as MouseEvent | undefined)?.shiftKey === true)
                }
            />
            <ColorPicker track={track} />
            <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline"
                title={track.name}
                onClick={() => actions.showTrack(track)}
            >
                {track.name}
            </button>
            <span className="shrink-0 text-muted-foreground text-xs tabular-nums" data-testid="track-length">
                {formatLength(tracksLength(track.segments))}
            </span>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-xs" aria-label={`Actions for ${track.name}`} />}
                >
                    <EllipsisVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                    <DropdownMenuItem onClick={() => editing.addSegment(track.id)}>Add segment</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.startAddPoint(track)}>Add point</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRename(track)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.duplicate(track)}>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.reverse(track)}>Reverse</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.remove(track)}>Delete</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => actions.saveTrack(track, 'gpx')}>Save as GPX</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.saveTrack(track, 'kml')}>Save as KML</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.copyTrackLink(track)}>
                        Copy link for track
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

export function TrackList() {
    const actions = useTrackActions();
    const editing = useRouteEditing();
    const tracks = useAppStore((state) => state.tracks);
    const loading = useAppStore((state) => state.loadingTracks > 0);
    const [expanded, setExpanded] = useState(true);
    const [url, setUrl] = useState('');
    const [renaming, setRenaming] = useState<Track | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    function loadUrl() {
        if (url.trim()) {
            actions.openUrl(url);
            setUrl('');
        }
    }

    return (
        <Card size="sm" className="pointer-events-auto w-full gap-2 py-2" data-testid="track-list">
            <div className="flex items-center gap-1 px-3">
                <span className="flex-1 font-medium">Tracks{tracks.length > 0 && ` (${tracks.length})`}</span>
                {loading && <LoaderCircleIcon className="size-4 animate-spin" aria-label="Loading tracks" />}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={expanded ? 'Collapse tracks' : 'Expand tracks'}
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </Button>
            </div>
            {expanded && (
                <>
                    <div className="flex items-center gap-1 px-3">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="New track"
                            title="New track"
                            onClick={() => {
                                editing.newTrack(url.trim());
                                setUrl('');
                            }}
                        >
                            <PlusIcon />
                        </Button>
                        <RoutingButton />
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Open file"
                            title="Open file"
                            onClick={() => fileInput.current?.click()}
                        >
                            <FolderOpenIcon />
                        </Button>
                        <input
                            ref={fileInput}
                            type="file"
                            multiple
                            hidden
                            data-testid="track-file-input"
                            onChange={(event) => {
                                actions.openFiles([...(event.target.files ?? [])]);
                                event.target.value = '';
                            }}
                        />
                        <Input
                            className="h-7 min-w-0 flex-1"
                            placeholder="Track URL"
                            aria-label="Track URL"
                            value={url}
                            disabled={loading}
                            onChange={(event) => setUrl(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    loadUrl();
                                }
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Download URL"
                            title="Download URL"
                            disabled={loading}
                            onClick={loadUrl}
                        >
                            <DownloadIcon />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon-sm" aria-label="Tracks menu" title="Menu" />}
                            >
                                <EllipsisIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-auto">
                                <DropdownMenuItem onClick={actions.copyAllLink}>
                                    Copy link for all tracks
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={actions.copyVisibleLink}>
                                    Copy link for visible tracks
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={actions.newTrackFromVisible}>
                                    Create new track from all visible tracks
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={tracks.length === 0} onClick={actions.saveAll}>
                                    Save all tracks to ZIP file
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={actions.removeAll}>Delete all tracks</DropdownMenuItem>
                                <DropdownMenuItem onClick={actions.removeHidden}>Delete hidden tracks</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    {tracks.length > 0 && (
                        <ul className="max-h-[40dvh] overflow-y-auto px-3" aria-label="Tracks">
                            {tracks.map((track) => (
                                <TrackRow key={track.id} track={track} onRename={setRenaming} />
                            ))}
                        </ul>
                    )}
                </>
            )}
            {renaming && <RenameTrackDialog track={renaming} onClose={() => setRenaming(null)} />}
            <CopyFallbackDialog />
        </Card>
    );
}
