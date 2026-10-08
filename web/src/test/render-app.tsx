import type { MapRef } from '@vis.gl/react-maplibre';
import { createRef } from 'react';
import { expect } from 'vitest';
import { render } from 'vitest-browser-react';
import { App } from '@/App';
import type { FixtureTiles } from './tiles';

// App с подменёнными тайлами и готовой картой. hash — адрес страницы до старта приложения (m=, l= …).
export async function renderApp(tiles: FixtureTiles, hash = '') {
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    const mapRef = createRef<MapRef>();
    const screen = await render(<App transformRequest={tiles.transformRequest} mapRef={mapRef} />);
    await expect.poll(() => mapRef.current?.getMap().loaded(), { timeout: 10_000 }).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: карта загружена строкой выше
    return { screen, map: mapRef.current!.getMap() };
}

// id слоёв карты снизу вверх, без серого фона (он есть всегда, style.ts)
export function mapLayerIds(map: { getStyle(): { layers: { id: string }[] } }) {
    return map
        .getStyle()
        .layers.map((layer) => layer.id)
        .filter((id) => id !== 'background');
}
