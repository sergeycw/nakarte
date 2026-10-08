import L from 'leaflet';

import {getLayers, layersDefs} from '~/layers';
import enableLayersConfig from '~/lib/leaflet.control.layers.configure';
// unserializeState контрола слоёв из адреса `l=` подключается побочным эффектом, как в App.js
import '~/lib/leaflet.hashState/Leaflet.Control.Layers'; // eslint-disable-line import/no-unassigned-import
import safeLocalStorage from '~/lib/safe-localstorage';

// Слои на данных автора, удалённые change drop-author-scan-layers: 17 сканов на tiles.nakarte.me,
// перевалы Вестры и geocaching.su. Коды могут остаться в старых ссылках и в localStorage.
const REMOVED_CODES = [
    'T',
    'D',
    'N',
    'A',
    'J',
    'C',
    'F',
    'B',
    'K',
    'U',
    'R',
    'E25m',
    'NT1',
    'NT5',
    'T25',
    'MN25',
    'Pur',
    'Wp',
    'Gc',
];
const SETTINGS_KEY = 'leafletLayersSettings';

suite('layers removed from the product');

function tileUrls(layer) {
    const urls = [];
    if (layer._url) {
        urls.push(layer._url);
    }
    if (layer.urls) {
        urls.push(...layer.urls.filter(Boolean));
    }
    if (layer.options.isWrapper) {
        layer.getLayers().forEach((subLayer) => urls.push(...tileUrls(subLayer)));
    }
    return urls;
}

test('removed codes are not defined', function () {
    const codes = layersDefs.map((layerDef) => layerDef.layer.options.code);
    for (const code of REMOVED_CODES) {
        assert.notInclude(codes, code, `layer ${code} is removed`);
    }
});

test('no tiles from tiles.nakarte.me', function () {
    for (const layerDef of layersDefs) {
        for (const url of tileUrls(layerDef.layer)) {
            assert.notMatch(url, /tiles\.nakarte\.me/u, layerDef.title);
        }
    }
});

suite('old codes of removed layers');

beforeEach(function () {
    this.savedSettings = safeLocalStorage.getItem(SETTINGS_KEY);
    safeLocalStorage.removeItem(SETTINGS_KEY);
});

afterEach(function () {
    if (this.map) {
        this.map.remove();
        this.map = null;
    }
    if (this.container) {
        document.body.removeChild(this.container);
        this.container = null;
    }
    if (this.savedSettings === null || this.savedSettings === undefined) {
        safeLocalStorage.removeItem(SETTINGS_KEY);
    } else {
        safeLocalStorage.setItem(SETTINGS_KEY, this.savedSettings);
    }
});

// Карта без setView: Leaflet откладывает onAdd слоёв до первого вида, поэтому тайлы не грузятся
// и тест не ходит в сеть, а map.hasLayer() уже видит добавленные слои.
function setUpLayersControl(testContext) {
    testContext.container = document.createElement('div');
    document.body.appendChild(testContext.container);
    testContext.map = L.map(testContext.container);
    const control = L.control.layers(null, null, {collapsed: false});
    enableLayersConfig(control, getLayers(), {withHotkeys: false});
    control.addTo(testContext.map);
    return control;
}

function codesOnMap(map) {
    const codes = [];
    map.eachLayer((layer) => {
        if (layer.options.code) {
            codes.push(layer.options.code);
        }
    });
    return codes;
}

test('link with a removed overlay opens the base layer', function () {
    const control = setUpLayersControl(this);
    assert.isTrue(control.unserializeState(['O', 'F']));
    assert.deepEqual(codesOnMap(this.map), ['O']);

    assert.isTrue(control.unserializeState(['O', 'Wp']));
    assert.deepEqual(codesOnMap(this.map), ['O']);
});

test('link with only a removed layer keeps the default layer', function () {
    const control = setUpLayersControl(this);
    assert.isFalse(control.unserializeState(['F']));
    assert.deepEqual(codesOnMap(this.map), ['O']);
});

test('stored settings with removed codes are dropped', function () {
    safeLocalStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
            layers: [
                {code: 'T', isCustom: false, enabled: true, hotkey: 'T'},
                {code: 'F', isCustom: false, enabled: true, hotkey: 'F'},
                {code: 'Wp', isCustom: false, enabled: true, hotkey: null},
                {code: 'Otm', isCustom: false, enabled: true, hotkey: 'V'},
            ],
        })
    );
    const control = setUpLayersControl(this);

    const enabledCodes = control
        .allLayers()
        .filter((layer) => layer.enabled)
        .map((layer) => layer.layer.options.code);
    assert.include(enabledCodes, 'Otm', 'settings of existing layers are applied');

    const storedCodes = JSON.parse(safeLocalStorage.getItem(SETTINGS_KEY)).layers.map((layer) => layer.code);
    assert.include(storedCodes, 'Otm');
    for (const code of ['T', 'F', 'Wp']) {
        assert.notInclude(storedCodes, code, `settings of removed layer ${code} are dropped`);
    }
});
