const RANGE = /^bytes=(\d*)-(\d*)$/u;

function parseRange(header, size) {
    const match = RANGE.exec(header ?? '');
    if (!match) {
        return null;
    }
    const [, from, to] = match;
    if (from === '') {
        return {start: Math.max(size - Number(to), 0), end: size - 1};
    }
    return {start: Number(from), end: to === '' ? size - 1 : Math.min(Number(to), size - 1)};
}

export async function onRequest({request, env}) {
    const asset = await env.ASSETS.fetch(new Request(request.url, {method: 'GET'}));
    if (!asset.ok) {
        return asset;
    }
    const body = await asset.arrayBuffer();
    const headers = new Headers(asset.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.delete('Content-Encoding');
    const range = parseRange(request.headers.get('Range'), body.byteLength);
    if (!range) {
        headers.set('Content-Length', String(body.byteLength));
        return new Response(request.method === 'HEAD' ? null : body, {headers});
    }
    if (range.start > range.end) {
        headers.set('Content-Range', `bytes */${body.byteLength}`);
        return new Response(null, {status: 416, headers});
    }
    const slice = body.slice(range.start, range.end + 1);
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${body.byteLength}`);
    headers.set('Content-Length', String(slice.byteLength));
    return new Response(request.method === 'HEAD' ? null : slice, {status: 206, headers});
}
