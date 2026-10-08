import type { RequestTransformFunction } from 'maplibre-gl';
import tileFixture from './tile.png?url';

// Сеть browser-тестов карты: тайлы любых слоёв (растр и DEM) уходят на локальную фикстуру, запрошенные адреса
// записываются. Запрос мимо localhost, который не тайл, попадает в external — тест обязан закончиться с пустым
// списком. Так тесты не ходят в сеть и ловят слой, который тянет что-то кроме тайлов.

export const TILE_FIXTURE_URL = new URL(tileFixture, location.href).href;

export interface FixtureTiles {
    transformRequest: RequestTransformFunction;
    // исходные адреса тайлов, которые запросила карта
    requested: string[];
    external: string[];
    // ответ на тайлы с адресом, совпавшим с шаблоном: свой адрес вместо фикстуры
    respond(pattern: RegExp, url: string): void;
}

export function fixtureTiles(): FixtureTiles {
    const overrides: [RegExp, string][] = [];
    const tiles: FixtureTiles = {
        requested: [],
        external: [],
        respond: (pattern, url) => {
            overrides.push([pattern, url]);
        },
        transformRequest: (url, resourceType) => {
            if (new URL(url).hostname === location.hostname) {
                return { url };
            }
            if (resourceType !== 'Tile') {
                tiles.external.push(url);
                return { url: 'about:blank' };
            }
            tiles.requested.push(url);
            const override = overrides.find(([pattern]) => pattern.test(url));
            return { url: override ? override[1] : TILE_FIXTURE_URL };
        },
    };
    return tiles;
}
