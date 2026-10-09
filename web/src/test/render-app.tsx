import type { MapRef } from '@vis.gl/react-maplibre';
import { type ComponentProps, createRef } from 'react';
import { expect } from 'vitest';
import { render } from 'vitest-browser-react';
import { App } from '@/App';
import { PROFILE_LAYERS } from '@/elevation/style';
import { EDIT_LAYERS } from '@/routing/edit-style';
import { TRACK_LAYERS } from '@/tracks/style';
import { fakeStreetView } from './fake-street-view';
import { memoryAutosave } from './memory-autosave';
import type { FixtureTiles } from './tiles';

// Сеть треков в browser-тестах: без заглушки любой запрос хранилища или прокси — ошибка сети (в сеть тесты не ходят)
const NO_NETWORK: typeof fetch = async (input) => {
    throw new TypeError(`no network in tests: ${String(input)}`);
};

interface RenderOptions {
    fetch?: typeof fetch;
    writeClipboard?: ComponentProps<typeof App>['writeClipboard'];
    router?: ComponentProps<typeof App>['router'];
    // хранилище автосохранения; по умолчанию — своё пустое в памяти на каждый рендер: рендеры App в одной странице
    // не видят треков друг друга, а общий IndexedDB страницы тестов не засоряется
    autosave?: ComponentProps<typeof App>['autosave'];
    // Street View: по умолчанию поддельный без панорам — в Google тесты не ходят
    streetView?: ComponentProps<typeof App>['streetView'];
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
            router={options.router}
            autosave={options.autosave === undefined ? memoryAutosave() : options.autosave}
            streetView={options.streetView ?? fakeStreetView([]).api}
        />,
    );
    await expect.poll(() => mapRef.current?.getMap().loaded(), { timeout: 10_000 }).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: карта загружена строкой выше
    return { screen, map: mapRef.current!.getMap() };
}

const ALWAYS_THERE = new Set([
    'background',
    ...[...PROFILE_LAYERS, ...TRACK_LAYERS, ...EDIT_LAYERS].map((layer) => layer.id),
]);

// id слоёв карты снизу вверх, без серого фона, слоёв профиля высот, треков и редактора (они есть всегда, layers/style.ts)
export function mapLayerIds(map: { getStyle(): { layers: { id: string }[] } }) {
    return map
        .getStyle()
        .layers.map((layer) => layer.id)
        .filter((id) => !ALWAYS_THERE.has(id));
}
