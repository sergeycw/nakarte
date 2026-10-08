import {isGoogleKeyless, markKeylessContainer} from '~/lib/leaflet.control.panoramas/lib/google/keyless';

suite('google street view without key');

const KEYLESS_URL = 'https://maps.googleapis.com/maps/api/js?v=3&key=';
const KEY_URL = 'https://maps.googleapis.com/maps/api/js?v=3&key=AIzaTestKey';

test('keyless is detected only for an empty key', function () {
    assert.isTrue(isGoogleKeyless(KEYLESS_URL));
    assert.isTrue(isGoogleKeyless('https://maps.googleapis.com/maps/api/js?key=&v=3'));
    assert.isFalse(isGoogleKeyless(KEY_URL));
    assert.isFalse(isGoogleKeyless('https://maps.googleapis.com/maps/api/js?v=3'));
});

// Разметка повторяет то, что Google строит в режиме без ключа (снято 2026-10-08 в клоне на 8766).
function makeGoogleLikeContainer(apiUrl) {
    const container = document.createElement('div');
    container.className = 'panorama-container';
    container.innerHTML =
        '<div class="gm-style">' +
        '<div aria-label="Street View"><canvas style="filter: invert(1);"></canvas></div>' +
        '<div style="position: absolute; z-index: 1000; font-size: 20px;">For development purposes only</div>' +
        '</div>' +
        '<div class="dialog">This page can\'t load Google Maps correctly.</div>';
    document.body.appendChild(container);
    markKeylessContainer(container, apiUrl);
    return container;
}

function styles(container) {
    return {
        scene: getComputedStyle(container.querySelector('[aria-label="Street View"]')).filter,
        watermark: getComputedStyle(container.querySelector('div[style*="z-index: 1000"]')).display,
        dialog: getComputedStyle(container.querySelector('.dialog')).display,
    };
}

test('keyless container hides google development mode', function () {
    const container = makeGoogleLikeContainer(KEYLESS_URL);
    try {
        const {scene, watermark, dialog} = styles(container);
        assert.include(scene, 'invert(1)');
        assert.equal(watermark, 'none');
        assert.equal(dialog, 'none');
    } finally {
        document.body.removeChild(container);
    }
});

test('container with a real key is left as is', function () {
    const container = makeGoogleLikeContainer(KEY_URL);
    try {
        const {scene, watermark, dialog} = styles(container);
        assert.notInclude(scene, 'invert');
        assert.notEqual(watermark, 'none');
        assert.notEqual(dialog, 'none');
    } finally {
        document.body.removeChild(container);
    }
});
