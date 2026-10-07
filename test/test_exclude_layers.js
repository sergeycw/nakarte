import cloneTarget from '~/config-target/clone';
import {excludeLayers} from '~/config-target/exclude-layers';
import {getLayers} from '~/layers';

suite('exclude layers');

function codesOf(layersConfig) {
    return layersConfig.layers.flatMap((group) => group.layers.map((layer) => layer.layer.options.code));
}

test('without codes returns input unchanged', function () {
    const layersConfig = getLayers();
    assert.strictEqual(excludeLayers(layersConfig, undefined), layersConfig);
    assert.strictEqual(excludeLayers(layersConfig, []), layersConfig);
});

test('clone hides Westra passes and geocaching.su', function () {
    assert.includeMembers(cloneTarget.excludedLayerCodes, ['Wp', 'Gc']);
    const layersConfig = getLayers();
    const filtered = excludeLayers(layersConfig, cloneTarget.excludedLayerCodes);
    const codes = codesOf(filtered);
    for (const code of cloneTarget.excludedLayerCodes) {
        assert.include(codesOf(layersConfig), code, `layer ${code} exists before filtering`);
        assert.notInclude(codes, code, `layer ${code} is hidden`);
    }
    assert.equal(codes.length, codesOf(layersConfig).length - cloneTarget.excludedLayerCodes.length);
    assert.deepEqual(filtered.customLayersOrder, layersConfig.customLayersOrder);
});

test('group with all layers excluded is dropped', function () {
    const layersConfig = getLayers();
    const group = layersConfig.layers[0];
    const filtered = excludeLayers(
        layersConfig,
        group.layers.map((layer) => layer.layer.options.code)
    );
    assert.notInclude(
        filtered.layers.map((filteredGroup) => filteredGroup.group),
        group.group
    );
    assert.equal(filtered.layers.length, layersConfig.layers.length - 1);
});
