import {
    DownloadIcon,
    EllipsisIcon,
    EllipsisVerticalIcon,
    FolderOpenIcon,
    ListIcon,
    LoaderCircleIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { ROUND_BUTTON } from '@/components/round-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useElevationProfile } from '@/elevation/context';
import { cn } from '@/lib/utils';
import { useRouteEditing } from '@/routing/editing-context';
import { RoutingButton } from '@/routing/RoutingButton';
import { useAppStore } from '@/state/context';
import { useTrackActions } from './actions-context';
import { formatLength, tracksLength } from './geometry';
import { TRACK_COLORS, type Track } from './model';
import { RenameTrackDialog } from './TrackDialogs';
import { TrackExportItems } from './TrackExportItems';

// Список треков (design add-web-tracks, «Список треков»; раскладка — макет 4a, design polish-web-ui): строка ввода, меню
// списка, строки треков с меню трека. Тексты меню — старого клиента. Действия — createTrackActions (actions.ts).

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
    const profile = useElevationProfile();
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
                    <DropdownMenuItem onClick={() => profile.open(track.id)}>Show elevation profile</DropdownMenuItem>
                    {/* checkbox-пункт Base UI сам меню не закрывает (как RadioItem) */}
                    <DropdownMenuCheckboxItem
                        closeOnClick
                        checked={track.measureTicksShown}
                        onCheckedChange={(checked) => actions.setMeasureTicks(track, checked)}
                    >
                        Show distance marks
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <TrackExportItems track={track} />
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

// Круглая кнопка списка слева сверху (design layout-three-zones), список — выпадающей панелью под строкой (TopBar). Число
// треков — данные, а не подпись, поэтому значком в углу кнопки; aria-label с числом — по нему ищут тесты
export function TracksButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
    const count = useAppStore((state) => state.tracks.length);
    const loading = useAppStore((state) => state.loadingTracks > 0);
    const label = count > 0 ? `Tracks ${count}` : 'Tracks';
    return (
        <Button
            variant="ghost"
            size="icon-lg"
            className={cn(ROUND_BUTTON, 'relative aria-expanded:bg-white/90')}
            aria-label={label}
            title={label}
            aria-expanded={open}
            onClick={onToggle}
        >
            {loading ? <LoaderCircleIcon className="animate-spin" aria-label="Loading tracks" /> : <ListIcon />}
            {count > 0 && (
                <span className="-top-1 -right-1 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground tabular-nums leading-none">
                    {count}
                </span>
            )}
        </Button>
    );
}

// Панель списка: шапка с инструментами списка (прокладка, файл, ссылка, меню списка) и строки треков. «New track» —
// кнопка верхней строки
export function TrackList() {
    const actions = useTrackActions();
    const tracks = useAppStore((state) => state.tracks);
    const loading = useAppStore((state) => state.loadingTracks > 0);
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
        <Card size="sm" className="pointer-events-auto w-full gap-1 py-1.5" data-testid="track-list">
            <div className="flex items-center gap-1 px-1.5">
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
                    className="h-7 min-w-0 flex-1 bg-background/60"
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
                        <DropdownMenuItem onClick={actions.copyAllLink}>Copy link for all tracks</DropdownMenuItem>
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
            {tracks.length > 0 ? (
                <ul
                    className="max-h-[calc(100dvh-9rem-var(--bottom-inset))] overflow-y-auto border-border/60 border-t px-2.5 pt-1"
                    aria-label="Tracks"
                >
                    {tracks.map((track) => (
                        <TrackRow key={track.id} track={track} onRename={setRenaming} />
                    ))}
                </ul>
            ) : (
                <p className="border-border/60 border-t px-3 pt-2 pb-1 text-muted-foreground text-xs">
                    No tracks yet: open a file, paste a link or draw a new one
                </p>
            )}
            {renaming && <RenameTrackDialog track={renaming} onClose={() => setRenaming(null)} />}
        </Card>
    );
}
