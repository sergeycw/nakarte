// Одно место адресов сервисов нового приложения. Значения — как у старого клиента
// (src/config.js + src/config-target/clone.js): те же Worker'ы на *.nakarte-routing.workers.dev,
// клон отличается только движком прокладки. Режим — режим Vite: `vite build --mode clone` для деплоя,
// остальные режимы — локальный серверный BRouter (docker-compose.yml).
const CORS_PROXY_URL = 'https://nakarte-cors-proxy.nakarte-routing.workers.dev/';
const ELEVATION_SERVER_URL = 'https://nakarte-elevation.nakarte-routing.workers.dev/';

export type RoutingEngine = 'browser' | 'server';

export interface Config {
    repoUrl: string;
    defaultLocation: [lat: number, lng: number];
    defaultZoom: number;
    osmTileUrl: string;
    corsProxyUrl: string;
    elevationsServer: string;
    tracksStorageServer: string;
    routingEngine: RoutingEngine;
    routingEngineRuntimeUrl: string;
    routingServer: string;
    routingTilesPath: string;
}

export function makeConfig(mode: string): Config {
    const clone = mode === 'clone';
    return {
        repoUrl: 'https://github.com/sergeycw/nakarte',
        // начальный вид старого клиента без параметров в адресе. Зум — в единицах MapLibre: у него мир на z0
        // 512 px, у Leaflet 256 px, поэтому тот же масштаб на 1 меньше (Leaflet z8 = MapLibre 7, тайлы OSM z8).
        // Разбор m= из старых ссылок обязан вычитать 1.
        defaultLocation: [49.73868, 33.45886],
        defaultZoom: 7,
        osmTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        corsProxyUrl: CORS_PROXY_URL,
        elevationsServer: ELEVATION_SERVER_URL,
        tracksStorageServer: 'https://nakarte-tracks.nakarte-routing.workers.dev',
        routingEngine: clone ? 'browser' : 'server',
        // загрузчик CheerpJ той же версии, что у старого клиента: лицензия Community работает только с этим CDN
        routingEngineRuntimeUrl: 'https://cjrtnc.leaningtech.com/4.3/loader.js',
        routingServer: 'http://localhost:17777',
        // клон читает тайлы BRouter с того же origin (functions/tiles), локальный dev — со стенда движка
        routingTilesPath: clone ? '/tiles/' : '/brouter-wasm/segments4/',
    };
}

export const config = makeConfig(import.meta.env.MODE);
