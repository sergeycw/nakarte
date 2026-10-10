import { ChevronDownIcon, ChevronUpIcon, MountainIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useElevationProfile } from '@/elevation/context';
import { meters } from '@/elevation/format';
import { profileStats } from '@/elevation/profile';
import { useAppStore } from '@/state/context';
import type { AppState } from '@/state/store';
import { formatLength, tracksLength } from '@/tracks/geometry';

// Кнопка профиля высот снизу по центру (три зоны, design layout-three-zones): профиль по кнопке, как в MapMagic
// (макет 4a). Стоит над нижними панелями (--bottom-inset), тосты — над ней. Подписи нет: длина и подъём — данные,
// название — в title и aria-label.

const hasLines = (segments: readonly (readonly unknown[])[]) => segments.some((segment) => segment.length > 1);

// Активный маршрут: редактируемый трек, иначе трек с открытым профилем, — если у него есть линии (ресёрч user-flows,
// «Раскладка: три зоны»). Правила «иначе первый видимый» больше нет: какой трек покажет кнопка, было не очевидно
function profileTrackId(state: AppState): string | null {
    const candidates = [
        state.tracks.find((track) => track.id === state.routeEdit?.trackId),
        state.tracks.find((track) => track.id === state.profile?.trackId),
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
        <button
            type="button"
            className="glass pointer-events-auto flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 font-medium text-sm tabular-nums transition-colors hover:bg-white/90 [&_svg]:size-4 [&_svg]:shrink-0"
            aria-label="Elevation profile"
            aria-expanded={open}
            title="Elevation profile"
            onClick={() => (open ? profile.close() : profile.open(track.id))}
        >
            <MountainIcon />
            {formatLength(tracksLength(track.segments))}
            {ascent !== null && <span className="font-normal text-muted-foreground">↑ {meters(ascent)}</span>}
            {open ? <ChevronDownIcon className="opacity-60" /> : <ChevronUpIcon className="opacity-60" />}
        </button>
    );
}

export function MapActions() {
    return (
        <div
            className="pointer-events-none absolute right-3 bottom-[calc(var(--bottom-inset)+0.75rem)] left-3 z-10 flex justify-center"
            data-testid="map-actions"
        >
            <ProfileButton />
        </div>
    );
}
