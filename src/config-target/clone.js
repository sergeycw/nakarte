const CORS_PROXY_URL = 'https://nakarte-cors-proxy.nakarte-routing.workers.dev/';

const configTarget = {
    CORSProxyUrl: CORS_PROXY_URL,
    tracksStorageServer: 'https://nakarte-tracks.nakarte-routing.workers.dev',
    elevationsServer: 'https://nakarte-elevation.nakarte-routing.workers.dev/',
    elevationTileUrl: 'https://nakarte-elevation.nakarte-routing.workers.dev/tiles/{z}/{x}/{y}',
    elevationsAttribution:
        'Elevation data: <a href="https://viewfinderpanoramas.org/dem3.html" target="_blank">' +
        'viewfinderpanoramas.org</a> (Jonathan de Ferranti)',
    wikimapiaTilesBaseUrl: `${CORS_PROXY_URL}wikimapia/`,
    routingEngine: 'browser',
    routingTilesPath: '/tiles/',
    // Слои на данных автора без своей замены: перевалы Вестры и geocaching.su (backlog.md).
    excludedLayerCodes: ['Wp', 'Gc'],
    eventsLogUrl: '',
    sentryDSN: '',
};

export default configTarget;
