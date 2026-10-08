import { Map as MapLibreMap, type MapRef, NavigationControl } from '@vis.gl/react-maplibre';
import { type Ref, useMemo } from 'react';
import { config } from '@/config';
import { maplibre } from './maplibre';
import { OSM_SOURCE_ID, osmStyle } from './osm-style';

interface BaseMapProps {
    tileUrl?: string;
    onTileError: () => void;
    ref?: Ref<MapRef>;
}

// Карта на весь контейнер. isolate: z-index контролов MapLibre (2) остаётся внутри контекста наложения
// карты, и панели приложения лежат над ними без гонки z-index (design add-web-skeleton, «Проверки»).
export function BaseMap({ tileUrl = config.osmTileUrl, onTileError, ref }: BaseMapProps) {
    const mapStyle = useMemo(() => osmStyle(tileUrl), [tileUrl]);
    const [lat, lng] = config.defaultLocation;
    return (
        <div className="absolute inset-0 isolate" data-testid="map">
            <MapLibreMap
                ref={ref}
                mapLib={maplibre}
                initialViewState={{ latitude: lat, longitude: lng, zoom: config.defaultZoom }}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                onError={(event) => {
                    // ошибка тайла приходит событием карты с sourceId источника; прочие ошибки — в консоль MapLibre
                    if ((event as { sourceId?: string }).sourceId === OSM_SOURCE_ID) {
                        onTileError();
                    }
                }}
            >
                <NavigationControl position="top-right" />
            </MapLibreMap>
        </div>
    );
}
