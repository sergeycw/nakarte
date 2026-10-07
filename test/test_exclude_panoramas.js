import L from 'leaflet';

import cloneTarget from '~/config-target/clone';
import {excludePanoramaProviders} from '~/config-target/exclude-panoramas';

suite('exclude panorama providers');

// Настоящий L.Control.Panoramas здесь не импортируется: в режиме testing babel не транспилирует
// node_modules, а зависимости провайдеров панорам с синтаксисом новее Firefox 52 ломают весь прогон
// в CI. Заглушка повторяет то, на что опирается фильтр: имена из getProviders() апстрима и сбор
// this.providers в initialize().
const PanoramasStub = L.Control.extend({
    initialize: function () {
        this.providers = this.getProviders();
    },

    getProviders: function () {
        return ['google', 'wikimedia', 'mapillary', 'mapycz'].map((providerName) => ({name: providerName}));
    },
});

function providerNames(PanoramasControl) {
    return new PanoramasControl().providers.map((provider) => provider.name);
}

test('without names returns control unchanged', function () {
    assert.strictEqual(excludePanoramaProviders(PanoramasStub, undefined), PanoramasStub);
    assert.strictEqual(excludePanoramaProviders(PanoramasStub, []), PanoramasStub);
});

test('clone keeps only Google street view', function () {
    assert.sameMembers(cloneTarget.excludedPanoramaProviders, ['wikimedia', 'mapillary', 'mapycz']);
    const ClonePanoramas = excludePanoramaProviders(PanoramasStub, cloneTarget.excludedPanoramaProviders);
    assert.deepEqual(providerNames(ClonePanoramas), ['google']);
});

test('filter keeps order of remaining providers', function () {
    const Filtered = excludePanoramaProviders(PanoramasStub, ['mapillary']);
    assert.deepEqual(providerNames(Filtered), ['google', 'wikimedia', 'mapycz']);
    assert.deepEqual(providerNames(PanoramasStub), ['google', 'wikimedia', 'mapillary', 'mapycz']);
});
