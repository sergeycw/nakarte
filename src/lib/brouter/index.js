import L from 'leaflet';

import config from '~/config';
import '~/lib/leaflet.lineutil.simplifyLatLngs';
import {fetch} from '~/lib/xhr-promise';

import {isEngineFailed, routeInEngine, startEngine} from './browser-engine';

const SIMPLIFY_TOLERANCE_DEGREES = 360 / (1 << 24);
const SNAP_DISTANCE_METERS = 20;
const MISSING_TILE_ERROR = /^datafile \S+\.rd5 not found$/u;

const activities = [
    {id: 'hiking', title: 'Hiking', profile: 'hiking-mountain'},
    {
        id: 'hiking-trails',
        title: 'Hiking, prefer trails',
        profile: 'hiking-mountain',
        params: [['path_preference', 20]],
    },
    {id: 'road-bike', title: 'Road bike', profile: 'fastbike'},
    {id: 'gravel', title: 'Gravel bike', profile: 'gravel'},
    {id: 'mtb', title: 'Mountain bike', profile: 'mtb'},
    {id: 'touring-bike', title: 'Touring bike', profile: 'trekking'},
];

function userFacingMessage(message) {
    if (MISSING_TILE_ERROR.test(message)) {
        return 'no routing data for this area';
    }
    return message;
}

class RoutingError extends Error {
    constructor(message, serverUnreachable) {
        super(userFacingMessage(message));
        this.name = 'RoutingError';
        this.serverUnreachable = serverUnreachable;
    }
}

function getActivity(id) {
    return activities.find((activity) => activity.id === id) ?? null;
}

function formatLonLat(latlng) {
    return `${latlng.lng.toFixed(6)},${latlng.lat.toFixed(6)}`;
}

function buildSegmentNodes(routePoints, from, to) {
    const nodes = L.LineUtil.simplifyLatlngs(routePoints, SIMPLIFY_TOLERANCE_DEGREES).map((p) =>
        L.latLng(p.lat, p.lng)
    );
    if (nodes.length && from.distanceTo(nodes[0]) < SNAP_DISTANCE_METERS) {
        nodes.shift();
    }
    if (nodes.length && to.distanceTo(nodes[nodes.length - 1]) < SNAP_DISTANCE_METERS) {
        nodes.pop();
    }
    return nodes;
}

function buildRouteParams(from, to, activityId) {
    const activity = getActivity(activityId) ?? activities[0];
    const params = new URLSearchParams();
    params.set('lonlats', [from, to].map(formatLonLat).join('|'));
    params.set('profile', activity.profile);
    for (const [paramName, value] of activity.params ?? []) {
        params.set(`profile:${paramName}`, String(value));
    }
    params.set('alternativeidx', '0');
    params.set('format', 'geojson');
    return params;
}

async function fetchGeojsonFromServer(params) {
    const url = new URL('/brouter', config.routingServer);
    url.search = params.toString();
    try {
        const xhr = await fetch(url.href, {timeout: 30000, maxTries: 1});
        return xhr.responseText;
    } catch (e) {
        if ((e.xhr?.status ?? 0) === 0) {
            throw new RoutingError('BRouter is not reachable', true);
        }
        throw new RoutingError(e.xhr.responseText?.trim() || e.message, false);
    }
}

async function fetchGeojsonFromBrowser(params) {
    let router;
    try {
        router = await startEngine();
    } catch (e) {
        throw new RoutingError(`BRouter engine failed to start: ${e.message}`, true);
    }
    try {
        return await routeInEngine(router, params.toString());
    } catch (e) {
        throw new RoutingError(e.message, false);
    }
}

async function fetchRoute(from, to, activityId) {
    const params = buildRouteParams(from, to, activityId);
    const geojson =
        config.routingEngine === 'browser'
            ? await fetchGeojsonFromBrowser(params)
            : await fetchGeojsonFromServer(params);
    const coordinates = JSON.parse(geojson).features?.[0]?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) {
        throw new RoutingError('empty route', false);
    }
    const routePoints = coordinates.map(([lng, lat]) => L.latLng(lat, lng));
    return buildSegmentNodes(routePoints, from, to);
}

async function isServerReachable() {
    if (config.routingEngine === 'browser') {
        return !isEngineFailed();
    }
    try {
        await fetch(new URL('/brouter', config.routingServer).href, {timeout: 3000, maxTries: 1});
    } catch (e) {
        return (e.xhr?.status ?? 0) !== 0;
    }
    return true;
}

function warmUpRouting() {
    if (config.routingEngine !== 'browser') {
        return;
    }
    startEngine().catch(() => null);
}

// Прокладка есть в сборке, если движку есть где считать: движку в браузере сервер не нужен,
// серверному нужен адрес. В клоне routingServer остаётся значением по умолчанию и не используется.
function isRoutingConfigured() {
    return config.routingEngine === 'browser' || Boolean(config.routingServer);
}

// Короткий статус для подсказки кнопки, когда роутер недоступен.
function routerDownStatus() {
    return config.routingEngine === 'browser' ? 'BRouter engine failed to load' : 'BRouter is not running';
}

// Статус с тем, что делать пользователю. `yarn local` имеет смысл только для серверного режима.
function routerDownHint() {
    return config.routingEngine === 'browser'
        ? 'BRouter engine failed to load, reload the page to retry'
        : 'BRouter is not running, start it with <b>yarn local</b>';
}

export {
    activities,
    getActivity,
    fetchRoute,
    isServerReachable,
    warmUpRouting,
    isRoutingConfigured,
    routerDownStatus,
    routerDownHint,
};
