import { LoaderCircleIcon, RotateCwIcon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { config } from '@/config';
import { useAppStore } from '@/state/context';
import type { ProfileData } from '@/state/store';
import { TRACK_COLORS } from '@/tracks/model';
import { useElevationProfile } from './context';
import { kilometers, meters } from './format';
import { ProfileGraph } from './ProfileGraph';
import { type ProfileStats, profileStats } from './profile';

// Панель профиля высот (design add-web-elevation-profile, «Где живёт профиль»): на всю ширину снизу, высота —
// PROFILE_HEIGHT; панели редактирования и точек, атрибуция карты и тосты встают над ней по --bottom-inset (App).
// Сверху — название, сводка в одну строку (на узком экране прокручивается) и закрытие, ниже — график.

export const PROFILE_HEIGHT = '12rem';

interface StatItem {
    key: string;
    label: string;
    value: string;
}

function statItems(stats: ProfileStats): StatItem[] {
    const items: StatItem[] = [{ key: 'distance', label: 'Distance', value: kilometers(stats.distance) }];
    if (stats.noData) {
        return items;
    }
    const approx = stats.missing ? '~' : '';
    const angle = (value: ProfileStats['ascentAngle']) => (value ? `${value.avg}° / ${value.max}°` : '-');
    items.push(
        { key: 'ascent', label: 'Ascent', value: approx + meters(stats.ascent) },
        { key: 'descent', label: 'Descent', value: approx + meters(stats.descent) },
        { key: 'min', label: 'Min', value: meters(stats.min) },
        { key: 'max', label: 'Max', value: meters(stats.max) },
        { key: 'start', label: 'Start', value: (stats.approxStart ? '~' : '') + meters(stats.start) },
        { key: 'finish', label: 'Finish', value: (stats.approxEnd ? '~' : '') + meters(stats.end) },
        { key: 'ascent-slope', label: 'Avg / max ascent', value: angle(stats.ascentAngle) },
        { key: 'descent-slope', label: 'Avg / max descent', value: angle(stats.descentAngle) },
    );
    return items;
}

function Stats({ data }: { data: ProfileData }) {
    const selection = useAppStore((state) => state.profileSelection);
    const values = data.values;
    const stats = useMemo(() => {
        if (!values) {
            return null;
        }
        if (!selection) {
            return profileStats(data.samples, values);
        }
        return profileStats(data.samples, values, Math.round(selection[0]), Math.round(selection[1]));
    }, [data.samples, values, selection]);
    if (!stats) {
        return null;
    }
    let note = '';
    if (stats.noData) {
        note = 'No elevation data';
    } else if (stats.missing) {
        note = 'Some elevation data missing';
    }
    return (
        <div className="flex min-w-0 flex-nowrap items-baseline gap-x-3 overflow-x-auto whitespace-nowrap text-xs">
            {selection && <span className="font-medium text-amber-700">Selection</span>}
            <dl className="flex items-baseline gap-x-3">
                {statItems(stats).map((item) => (
                    <div key={item.key} className="flex gap-1">
                        <dt className="text-muted-foreground">{item.label}</dt>
                        <dd className="font-medium tabular-nums" data-stat={item.key}>
                            {item.value}
                        </dd>
                    </div>
                ))}
            </dl>
            {note && (
                <span className="text-amber-700" data-testid="profile-note">
                    {note}
                </span>
            )}
        </div>
    );
}

export function ElevationProfile() {
    const profile = useElevationProfile();
    const target = useAppStore((state) => state.profile);
    const data = useAppStore((state) => state.profileData);
    const track = useAppStore((state) => state.tracks.find((item) => item.id === state.profile?.trackId));
    if (!target || !track) {
        return null;
    }
    const title =
        target.segment !== null && track.segments.length > 1
            ? `${track.name}, segment ${target.segment + 1}`
            : track.name;
    const updating = data?.updating ?? true;
    return (
        <Card
            size="sm"
            className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 gap-1 px-3 py-2"
            style={{ height: PROFILE_HEIGHT }}
            data-testid="elevation-profile"
            role="region"
            aria-label="Elevation profile"
        >
            {/* на узком экране сводка — второй строкой под названием, на широком — в одной строке с ним */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                    className="block h-1.5 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: TRACK_COLORS[track.color] }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-sm sm:max-w-40 sm:flex-none" title={title}>
                    {title}
                </span>
                {updating && (
                    <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin" aria-label="Loading elevation" />
                )}
                <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
                    {data && <Stats data={data} />}
                </div>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Close elevation profile"
                    title="Close"
                    onClick={profile.close}
                >
                    <XIcon />
                </Button>
            </div>
            <div className="relative min-h-0 flex-1">
                {data?.error && (
                    <div
                        className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 rounded-md bg-background/90 px-2 py-1 text-destructive text-xs"
                        role="alert"
                    >
                        <span className="min-w-0 flex-1">Failed to get elevation data: {data.error}</span>
                        <Button size="xs" variant="outline" onClick={profile.retry}>
                            <RotateCwIcon />
                            Retry
                        </Button>
                    </div>
                )}
                {data?.values ? (
                    <ProfileGraph data={data} />
                ) : (
                    !data?.error && (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                            Loading elevation…
                        </div>
                    )
                )}
            </div>
            <a
                className="self-end text-[10px] text-muted-foreground leading-none hover:underline"
                href={config.elevationsAttribution.url}
                target="_blank"
                rel="noreferrer"
            >
                Elevation data: {config.elevationsAttribution.text}
            </a>
        </Card>
    );
}
