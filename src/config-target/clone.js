// Отличия публичного клона на Cloudflare от локального серверного режима: BRouter в браузере
// (CheerpJ) и тайлы BRouter с того же origin через functions/tiles.
const configTarget = {
    routingEngine: 'browser',
    routingTilesPath: '/tiles/',
};

export default configTarget;
