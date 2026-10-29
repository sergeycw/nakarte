import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useTrackActions } from './actions-context';
import type { Track } from './model';

// Экспорт и ссылка одного трека: общие пункты меню трека в списке и меню «Share track» редактора (design
// editor-name-share). Тексты — старого клиента, по ним ищут тесты.
export function TrackExportItems({ track }: { track: Track }) {
    const actions = useTrackActions();
    return (
        <>
            {/* GPX — всегда с высотами, в подписи об этом не пишем (владелец 2026-10-29, design trim-track-menus) */}
            <DropdownMenuItem onClick={() => void actions.saveTrack(track, 'gpx')}>Save as GPX</DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.saveTrack(track, 'kml')}>Save as KML</DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.copyTrackLink(track)}>Copy link for track</DropdownMenuItem>
        </>
    );
}
