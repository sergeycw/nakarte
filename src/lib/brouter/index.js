import L from 'leaflet';

import config from '~/config';
import '~/lib/leaflet.lineutil.simplifyLatLngs';
import {fetch} from '~/lib/xhr-promise';

const SIMPLIFY_TOLERANCE_DEGREES = 360 / (1 << 24);
const SNAP_DISTANCE_METERS = 20;

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

class RoutingError extends Error {
    constructor(message, serverUnreachable) {
        super(message);
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

async function fetchRoute(from, to, activityId) {
    const activity = getActivity(activityId) ?? activities[0];
    const url = new URL('/brouter', config.routingServer);
    url.searchParams.set('lonlats', [from, to].map(formatLonLat).join('|'));
    url.searchParams.set('profile', activity.profile);
    for (const [paramName, value] of activity.params ?? []) {
        url.searchParams.set(`profile:${paramName}`, String(value));
    }
    url.searchParams.set('alternativeidx', '0');
    url.searchParams.set('format', 'geojson');

    let xhr;
    try {
        xhr = await fetch(url.href, {timeout: 30000, maxTries: 1});
    } catch (e) {
        if ((e.xhr?.status ?? 0) === 0) {
            throw new RoutingError('BRouter is not reachable', true);
        }
        throw new RoutingError(e.xhr.responseText?.trim() || e.message, false);
    }
    const coordinates = JSON.parse(xhr.responseText).features?.[0]?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) {
        throw new RoutingError('empty route', false);
    }
    const routePoints = coordinates.map(([lng, lat]) => L.latLng(lat, lng));
    return buildSegmentNodes(routePoints, from, to);
}

async function isServerReachable() {
    try {
        await fetch(new URL('/brouter', config.routingServer).href, {timeout: 3000, maxTries: 1});
    } catch (e) {
        return (e.xhr?.status ?? 0) !== 0;
    }
    return true;
}

export {activities, getActivity, fetchRoute, isServerReachable};
