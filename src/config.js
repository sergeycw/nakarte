import configTarget from '~/config-target';

import secrets from './secrets';

// Свои Worker'ы на Cloudflare вместо сервисов автора *.nakarte.me (workers/, AGENTS.md «Свои бэкенды»).
// Значения общие для всех сборок; ~/config-target переопределяет только отличия клона.
const CORS_PROXY_URL = 'https://nakarte-cors-proxy.nakarte-routing.workers.dev/';
const ELEVATION_SERVER_URL = 'https://nakarte-elevation.nakarte-routing.workers.dev/';

const config = {
    caption: `nakarte routing | <a href="https://github.com/sergeycw/nakarte">GitHub</a>`,
    defaultLocation: [49.73868, 33.45886],
    defaultZoom: 8,
    googleApiUrl: `https://maps.googleapis.com/maps/api/js?v=3&key=${secrets.google}`,
    CORSProxyUrl: CORS_PROXY_URL,
    elevationsServer: ELEVATION_SERVER_URL,
    // условия viewfinderpanoramas.org требуют атрибуцию со ссылкой на источник
    elevationsAttribution:
        'Elevation data: <a href="https://viewfinderpanoramas.org/dem3.html" target="_blank">' +
        'viewfinderpanoramas.org</a> (Jonathan de Ferranti)',
    tracksStorageServer: 'https://nakarte-tracks.nakarte-routing.workers.dev',
    wikimapiaTilesBaseUrl: `${CORS_PROXY_URL}wikimapia/`,
    urlsBypassCORSProxy: [new RegExp('^https://pkk\\.rosreestr\\.ru/', 'u')],
    elevationTileUrl: `${ELEVATION_SERVER_URL}tiles/{z}/{x}/{y}`,
    routingServer: 'http://localhost:17777',
    routingEngine: 'server',
    routingTilesPath: '/brouter-wasm/segments4/',
    // своего сбора событий и Sentry нет
    eventsLogUrl: '',
    sentryDSN: '',
    routingProfile: 'hiking-mountain',
    ...secrets,
    ...configTarget,
};

export default config;
