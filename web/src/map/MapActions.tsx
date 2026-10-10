import { ChevronDownIcon, ChevronUpIcon, MountainIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useElevationProfile } from '@/elevation/context';
import { meters } from '@/elevation/format';
import { profileStats } from '@/elevation/profile';
import { useAppStore } from '@/state/context';
import type { AppState } from '@/state/store';
import { formatLength, tracksLength } from '@/tracks/geometry';

// Кнопка профиля высот снизу по центру (три зоны, design layout-three-zones): профиль по кнопке, как в MapMagic
// (макет 4a). Стоит над нижними панелями (--bottom-inset), тосты — над ней. Подписи нет: длина и подъём — данные,
// название — в title и скрытым текстом.

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
    // открыт профиль этого трека: правится A, а открыт профиль B — кнопка A свёрнута и откроет профиль A
    const open = useAppStore((state) => trackId !== null && state.profile?.trackId === trackId);
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
    const shown = track !== undefined;
    // раскрытая атрибуция с линейкой масштаба слева снизу встаёт над кнопкой, пока она есть (index.css): длинная
    // атрибуция нескольких слоёв доходит до центра окна
    useEffect(() => {
        if (!shown) {
            return;
        }
        const root = document.documentElement;
        root.style.setProperty('--profile-button-inset', '3.25rem');
        return () => {
            root.style.removeProperty('--profile-button-inset');
        };
    }, [shown]);
    if (!track) {
        return null;
    }
    return (
        // имя — скрытое «Elevation profile» и видимые длина и подъём, а не aria-label: тот спрятал бы данные от
        // скринридера (WCAG 2.5.3, видимый текст входит в имя)
        <button
            type="button"
            className="glass pointer-events-auto flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 font-medium text-sm tabular-nums transition-colors hover:bg-white/90 [&_svg]:size-4 [&_svg]:shrink-0"
            aria-expanded={open}
            title="Elevation profile"
            onClick={() => (open ? profile.close() : profile.open(track.id))}
        >
            <MountainIcon aria-hidden="true" />
            <span className="sr-only">Elevation profile</span>
            {formatLength(tracksLength(track.segments))}
            {ascent !== null && <span className="font-normal text-muted-foreground">↑ {meters(ascent)}</span>}
            {open ? (
                <ChevronDownIcon className="opacity-60" aria-hidden="true" />
            ) : (
                <ChevronUpIcon className="opacity-60" aria-hidden="true" />
            )}
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
