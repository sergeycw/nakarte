import { BinocularsIcon, ChevronDownIcon, ChevronUpIcon, MountainIcon, RulerIcon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo } from 'react';
import { useElevationProfile } from '@/elevation/context';
import { meters } from '@/elevation/format';
import { profileStats } from '@/elevation/profile';
import { cn } from '@/lib/utils';
import { useRouteEditing } from '@/routing/editing-context';
import { useAppStore } from '@/state/context';
import type { AppState } from '@/state/store';
import { useStreetView } from '@/streetview/context';
import { formatLength, tracksLength } from '@/tracks/geometry';

// Строка кнопок снизу справа (макет Claude Design 4a, design polish-web-ui): профиль высот по кнопке, как в MapMagic,
// «Measure distance» и Street View. Стоит над нижними панелями (--bottom-inset), тосты — над ней. На узком окне у
// линейки и Street View только иконки: подписи остаются в aria-label.

function ActionButton({
    pressed,
    className,
    children,
    ...props
}: { pressed?: boolean; children: ReactNode } & React.ComponentProps<'button'>) {
    return (
        <button
            type="button"
            className={cn(
                'glass pointer-events-auto flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 font-medium text-sm transition-colors hover:bg-white/90 [&_svg]:size-4 [&_svg]:shrink-0',
                pressed && 'bg-primary! text-primary-foreground hover:bg-primary/90!',
                className,
            )}
            aria-pressed={pressed}
            {...props}
        >
            {children}
        </button>
    );
}

const hasLines = (segments: readonly (readonly unknown[])[]) => segments.some((segment) => segment.length > 1);

// Трек кнопки профиля: редактируемый, иначе с открытым профилем, иначе первый видимый — первый из них с линиями
// (design polish-web-ui, «Макет 4a»: «текущего трека» в приложении нет)
function profileTrackId(state: AppState): string | null {
    const candidates = [
        state.tracks.find((track) => track.id === state.routeEdit?.trackId),
        state.tracks.find((track) => track.id === state.profile?.trackId),
        ...state.tracks.filter((track) => track.visible),
    ];
    return candidates.find((track) => track && hasLines(track.segments))?.id ?? null;
}

function ProfileButton() {
    const profile = useElevationProfile();
    const trackId = useAppStore(profileTrackId);
    const track = useAppStore((state) => state.tracks.find((item) => item.id === trackId));
    const open = useAppStore((state) => state.profile !== null);
    // подъём — только из уже посчитанного профиля всего трека: запрос высот ради подписи тратил бы лимит API высот
    const data = useAppStore((state) =>
        state.profile?.trackId === trackId && state.profile.segment === null ? state.profileData : null,
    );
    const ascent = useMemo(() => {
        if (!data?.values) {
            return null;
        }
        const stats = profileStats(data.samples, data.values);
        return stats.noData ? null : stats.ascent;
    }, [data]);
    if (!track) {
        return null;
    }
    return (
        <ActionButton
            aria-label="Elevation profile"
            aria-expanded={open}
            title="Elevation profile"
            onClick={() => (open ? profile.close() : profile.open(track.id))}
        >
            <MountainIcon />
            <span className="hidden sm:inline">Elevation profile</span>
            <span className="font-normal text-muted-foreground tabular-nums">
                {formatLength(tracksLength(track.segments))}
                {ascent !== null && ` · ↑ ${meters(ascent)}`}
            </span>
            {open ? <ChevronDownIcon className="opacity-60" /> : <ChevronUpIcon className="opacity-60" />}
        </ActionButton>
    );
}

// «Measure distance»: трек Ruler с отметками расстояния и сразу рисование (control-ruler.js старого)
function RulerButton() {
    const editing = useRouteEditing();
    return (
        <ActionButton
            aria-label="Measure distance"
            title="Measure distance"
            onClick={() => editing.newTrack('Ruler', { measureTicksShown: true })}
        >
            <RulerIcon />
            <span className="hidden sm:inline">Measure distance</span>
        </ActionButton>
    );
}

// Режим Street View (кнопка и Alt+P старого контрола панорам; code, а не key: на macOS Alt меняет символ)
function StreetViewButton() {
    const streetView = useStreetView();
    const enabled = useAppStore((state) => state.streetView.enabled);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey && event.code === 'KeyP') {
                event.preventDefault();
                streetView.toggle();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [streetView]);
    return (
        <ActionButton
            aria-label="Street View"
            title="Street View (Alt+P)"
            pressed={enabled}
            onClick={() => streetView.toggle()}
        >
            <BinocularsIcon />
            <span className="hidden sm:inline">Street View</span>
        </ActionButton>
    );
}

export function MapActions() {
    return (
        <div
            // в низком окне (телефон в альбомной) строка уступает место столбцу кнопок справа: иначе закрывает зум
            className="pointer-events-none absolute right-3 bottom-[calc(var(--bottom-inset)+0.75rem)] left-3 z-10 flex justify-end gap-2 [@media(max-height:480px)]:right-[4.5rem]"
            data-testid="map-actions"
        >
            <ProfileButton />
            <RulerButton />
            <StreetViewButton />
        </div>
    );
}
