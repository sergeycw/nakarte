import type { RequestTransformFunction } from 'maplibre-gl';
import { CONTOUR_PROTOCOL, OPENFREEMAP_TILEJSON } from '@/layers/catalog';
// настоящий тайл OpenFreeMap z12/2554/1509 у Казбека (planet 20261004_113936_pt, скачан 2026-10-12): вершины с ele,
// населённые пункты с name, name:ru и name:latin. Данные © OpenStreetMap contributors (ODbL), схема © OpenMapTiles
import vectorTileFixture from './openfreemap-tile.pbf?url';
import tileFixture from './tile.png?url';

// Сеть browser-тестов карты: тайлы любых слоёв (растр и DEM; векторные .pbf — на свою фикстуру) уходят на локальную
// фикстуру, запрошенные адреса записываются. Запрос мимо localhost, который не тайл, попадает в external — тест обязан
// закончиться с пустым списком. Так тесты не ходят в сеть и ловят слой, который тянет что-то кроме тайлов.

export const TILE_FIXTURE_URL = new URL(tileFixture, location.href).href;
const VECTOR_TILE_FIXTURE_URL = new URL(vectorTileFixture, location.href).href;

// TileJSON OpenFreeMap (подложка Of): адрес тайлов — как у настоящего, с версией сборки, а сами тайлы уходят на
// фикстуру векторного тайла. data: URL, а не файл: dev-сервер Vite отдаёт .json модулем
const OPENFREEMAP_TILES = 'https://tiles.openfreemap.org/planet/fixture/{z}/{x}/{y}.pbf';
const OPENFREEMAP_TILEJSON_FIXTURE = `data:application/json,${encodeURIComponent(
    JSON.stringify({ tilejson: '3.0.0', tiles: [OPENFREEMAP_TILES], minzoom: 0, maxzoom: 14 }),
)}`;

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
            // протокол горизонталей — не сеть: renderApp ставит его обработчик, который берёт тайлы рельефа через этот же
            // transformRequest (src/layers/contours.ts)
            const { hostname, protocol } = new URL(url);
            if (hostname === location.hostname || protocol === `${CONTOUR_PROTOCOL}:`) {
                return { url };
            }
            // описание тайлов векторной подложки — не тайл, но и не утечка: записывается вместе с тайлами
            if (url === OPENFREEMAP_TILEJSON) {
                tiles.requested.push(url);
                // respond подменяет и описание тайлов: так тест роняет OpenFreeMap целиком (откат Of → Tt)
                const override = overrides.find(([pattern]) => pattern.test(url));
                return { url: override ? override[1] : OPENFREEMAP_TILEJSON_FIXTURE };
            }
            if (resourceType !== 'Tile') {
                tiles.external.push(url);
                return { url: 'about:blank' };
            }
            tiles.requested.push(url);
            const override = overrides.find(([pattern]) => pattern.test(url));
            if (override) {
                return { url: override[1] };
            }
            return { url: url.endsWith('.pbf') ? VECTOR_TILE_FIXTURE_URL : TILE_FIXTURE_URL };
        },
    };
    return tiles;
}
