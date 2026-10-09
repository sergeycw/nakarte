import { Marker, useMap } from '@vis.gl/react-maplibre';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { useEffect } from 'react';
import { useAppStore, useAppStoreApi } from '@/state/context';
import { cursorInfo } from './format';
import { nearestIndex, pointAt } from './profile';
import { PROFILE_SELECTION, selectionFeature } from './style';

// Профиль на карте (design add-web-elevation-profile, «Курсор на карте»): метка в точке курсора графика, выделенный
// участок и наведение мыши на линию профиля — курсор графика встаёт в ближайшее место. Ближайшее место ищется
// проекцией точек выборки (map.project), а не по отрисованному кадру: не зависит от кадра и не требует слоя.

// насколько близко к линии профиля должна быть мышь, px
const HOVER_DISTANCE = 10;

export function ProfileOnMap() {
    const { current } = useMap();
    const store = useAppStoreApi();
    const data = useAppStore((state) => state.profileData);
    const cursor = useAppStore((state) => state.profileCursor);
    const selection = useAppStore((state) => state.profileSelection);
    // линию скрытого трека не видно — наведение на её место курсор не ставит
    const visible = useAppStore(
        (state) => state.tracks.find((track) => track.id === state.profile?.trackId)?.visible ?? false,
    );
    const map = current?.getMap();

    // выделение — данные источника мимо стиля; пересборка стиля сбрасывает их — вернуть на styledata
    useEffect(() => {
        if (!map) {
            return;
        }
        const apply = () => {
            const source = map.getSource(PROFILE_SELECTION) as GeoJSONSource | undefined;
            const features =
                data && selection
                    ? [selectionFeature(data.samples.points, data.samples.starts, selection[0], selection[1])]
                    : [];
            source?.setData({ type: 'FeatureCollection', features });
        };
        apply();
        map.on('styledata', apply);
        return () => {
            map.off('styledata', apply);
        };
    }, [map, data, selection]);

    // наведение мыши на линию профиля; проекция — раз в кадр
    useEffect(() => {
        if (!map || !data?.values || !visible) {
            return;
        }
        const { points, starts } = data.samples;
        let frame = 0;
        let hovering = false;
        const onMove = (event: MapMouseEvent) => {
            cancelAnimationFrame(frame);
            const at = event.point;
            frame = requestAnimationFrame(() => {
                const screen = points.map((p) => map.project([p.lng, p.lat]));
                const index = nearestIndex(screen, starts, at, HOVER_DISTANCE);
                if (index !== null) {
                    hovering = true;
                    store.getState().setProfileCursor(index);
                } else if (hovering) {
                    hovering = false;
                    store.getState().setProfileCursor(null);
                }
            });
        };
        const onOut = () => {
            cancelAnimationFrame(frame);
            if (hovering) {
                hovering = false;
                store.getState().setProfileCursor(null);
            }
        };
        map.on('mousemove', onMove);
        map.on('mouseout', onOut);
        return () => {
            cancelAnimationFrame(frame);
            map.off('mousemove', onMove);
            map.off('mouseout', onOut);
        };
    }, [map, data, store, visible]);

    if (!data?.values || cursor === null) {
        return null;
    }
    const at = pointAt(data.samples.points, cursor);
    const info = cursorInfo(data, cursor);
    return (
        <Marker longitude={at.lng} latitude={at.lat} style={{ pointerEvents: 'none' }}>
            <div className="relative" data-testid="profile-marker">
                <div className="size-3 rounded-full border-2 border-white bg-amber-700 shadow" />
                <div className="absolute top-1/2 left-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] leading-tight tabular-nums shadow-sm ring-1 ring-foreground/10">
                    {info.elevation} · {info.distance} · {info.slope}
                </div>
            </div>
        </Marker>
    );
}
