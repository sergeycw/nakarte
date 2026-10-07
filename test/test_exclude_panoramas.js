import L from 'leaflet';

import '~/lib/leaflet.control.panoramas'; // eslint-disable-line import/no-unassigned-import
import cloneTarget from '~/config-target/clone';
import {excludePanoramaProviders} from '~/config-target/exclude-panoramas';

suite('exclude panorama providers');

function providerNames(PanoramasControl) {
    return new PanoramasControl().providers.map((provider) => provider.name);
}

test('without names returns control unchanged', function () {
    assert.strictEqual(excludePanoramaProviders(L.Control.Panoramas, undefined), L.Control.Panoramas);
    assert.strictEqual(excludePanoramaProviders(L.Control.Panoramas, []), L.Control.Panoramas);
});

test('clone keeps only Google street view', function () {
    assert.includeMembers(providerNames(L.Control.Panoramas), ['google', 'wikimedia', 'mapillary', 'mapycz']);
    const ClonePanoramas = excludePanoramaProviders(L.Control.Panoramas, cloneTarget.excludedPanoramaProviders);
    assert.deepEqual(providerNames(ClonePanoramas), ['google']);
});

test('control keeps a container per remaining provider', function () {
    const ClonePanoramas = excludePanoramaProviders(L.Control.Panoramas, ['mapillary']);
    const control = new ClonePanoramas();
    assert.deepEqual(
        control.providers.map((provider) => provider.name),
        ['google', 'wikimedia', 'mapycz']
    );
    assert.equal(control._panoramasContainer.querySelectorAll('.panorama-container').length, 3);
});
