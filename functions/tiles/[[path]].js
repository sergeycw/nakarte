import tiles from '../../workers/tiles/src';

export function onRequest(context) {
    return tiles.fetch(context.request, context.env);
}
