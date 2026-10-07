const CORS_PROXY_URL = 'https://nakarte-cors-proxy.nakarte-routing.workers.dev/';

const configTarget = {
    CORSProxyUrl: CORS_PROXY_URL,
    tracksStorageServer: 'https://nakarte-tracks.nakarte-routing.workers.dev',
    wikimapiaTilesBaseUrl: `${CORS_PROXY_URL}wikimapia/`,
    routingEngine: 'browser',
    routingTilesPath: '/tiles/',
    eventsLogUrl: '',
    sentryDSN: '',
};

export default configTarget;
