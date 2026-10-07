import L from 'leaflet';

import '~/lib/leaflet.polyline-edit'; // eslint-disable-line import/no-unassigned-import

const EditableLine = L.Polyline.extend({includes: L.Polyline.EditMixin});

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeMap() {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '400px';
    document.body.appendChild(container);
    const map = L.map(container).setView([41.69, 44.78], 15);
    return {map, container};
}

async function drawRoutedLine(map, direction) {
    const a = L.latLng(41.69, 44.775);
    const b = L.latLng(41.692, 44.78);
    const c = L.latLng(41.688, 44.785);
    const line = new EditableLine([a]).addTo(map);
    line.router = {
        activityId: () => 'hiking',
        route: (start, end) =>
            Promise.resolve([L.latLng((start.lat + end.lat) / 2 + 0.0005, (start.lng + end.lng) / 2)]),
    };
    line.startEdit();
    line.startDrawingLine(direction, {latlng: a.clone()});
    line.onMapClick({latlng: b});
    await flushPromises();
    line.onMapClick({latlng: c});
    await flushPromises();
    return line;
}

suite('polyline-edit: stop drawing');

[1, -1].forEach((direction) => {
    test(`fixed nodes keep the last waypoint while drawing stops, direction ${direction}`, async function () {
        const {map, container} = makeMap();
        try {
            const line = await drawRoutedLine(map, direction);
            const fixedBefore = line.getFixedLatLngs();
            assert.equal(fixedBefore.length, 5);
            assert.equal(fixedBefore.filter((node) => node._routeLeg).length, 2);

            const seen = [];
            line.on('nodeschanged', () => seen.push(line.getFixedLatLngs()));
            line.stopDrawingLine();

            assert.isNotEmpty(seen);
            for (const fixed of seen) {
                assert.equal(fixed.length, 5);
                assert.notExists(fixed[0]._routeLeg);
                assert.notExists(fixed[fixed.length - 1]._routeLeg);
            }
            assert.deepEqual(line.getFixedLatLngs(), fixedBefore);
        } finally {
            map.remove();
            container.remove();
        }
    });
});
