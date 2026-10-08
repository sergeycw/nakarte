import type { MapRef } from '@vis.gl/react-maplibre';
import { type ComponentProps, createRef } from 'react';
import { expect } from 'vitest';
import { render } from 'vitest-browser-react';
import { App } from '@/App';
import { TRACK_LABELS, TRACK_LINES, TRACK_POINTS } from '@/tracks/style';
import type { FixtureTiles } from './tiles';

// Сеть треков в browser-тестах: без заглушки любой запрос хранилища или прокси — ошибка сети (в сеть тесты не ходят)
const NO_NETWORK: typeof fetch = async (input) => {
    throw new TypeError(`no network in tests: ${String(input)}`);
};

interface RenderOptions {
    fetch?: typeof fetch;
    writeClipboard?: ComponentProps<typeof App>['writeClipboard'];
}

// App с подменёнными тайлами и готовой картой. hash — адрес страницы до старта приложения (m=, l= …).
export async function renderApp(tiles: FixtureTiles, hash = '', options: RenderOptions = {}) {
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    const mapRef = createRef<MapRef>();
    const screen = await render(
        <App
            transformRequest={tiles.transformRequest}
            mapRef={mapRef}
            fetch={options.fetch ?? NO_NETWORK}
            writeClipboard={options.writeClipboard}
        />,
    );
    await expect.poll(() => mapRef.current?.getMap().loaded(), { timeout: 10_000 }).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: карта загружена строкой выше
    return { screen, map: mapRef.current!.getMap() };
}

const ALWAYS_THERE = new Set(['background', TRACK_LINES, TRACK_POINTS, TRACK_LABELS]);

// id слоёв карты снизу вверх, без серого фона и слоёв треков (они есть всегда, style.ts)
export function mapLayerIds(map: { getStyle(): { layers: { id: string }[] } }) {
    return map
        .getStyle()
        .layers.map((layer) => layer.id)
        .filter((id) => !ALWAYS_THERE.has(id));
}
