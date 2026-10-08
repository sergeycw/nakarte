import configTarget from '~/config-target';

import secrets from './secrets';

const config = {
    caption: `
        <a href="https://docs.nakarte.me">Documentation</a> |
        <a href="https://about.nakarte.me">News</a> |
        <a href="mailto:nakarte@nakarte.me" target="_self">nakarte@nakarte.me</a> |
        <a href="https://about.nakarte.me/p/blog-page_29.html">Donate</a>`,
    defaultLocation: [49.73868, 33.45886],
    defaultZoom: 8,
    googleApiUrl: `https://maps.googleapis.com/maps/api/js?v=3&key=${secrets.google}`,
    CORSProxyUrl: 'https://proxy.nakarte.me/',
    elevationsServer: 'https://elevation.nakarte.me/',
    tracksStorageServer: 'https://tracks.nakarte.me',
    wikimapiaTilesBaseUrl: 'https://proxy.nakarte.me/wikimapia/',
    urlsBypassCORSProxy: [new RegExp('^https://pkk\\.rosreestr\\.ru/', 'u')],
    elevationTileUrl: 'https://tiles.nakarte.me/elevation/{z}/{x}/{y}',
    routingServer: 'http://localhost:17777',
    routingEngine: 'server',
    routingTilesPath: '/brouter-wasm/segments4/',
    eventsLogUrl: 'https://nakarte.me/event',
    routingProfile: 'hiking-mountain',
    ...secrets,
    ...configTarget,
};

export default config;
