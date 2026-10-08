import config from '~/config';

// Значения по умолчанию в src/config.js — свои Worker'ы, а не сервисы автора *.nakarte.me
// (drop-author-services). Karma собирает без NAKARTE_TARGET, то есть проверяет сборку без цели.
suite('own backends by default');

const AUTHOR_HOST = /nakarte\.me/u;

test('service urls are not on nakarte.me', function () {
    const keys = [
        'CORSProxyUrl',
        'wikimapiaTilesBaseUrl',
        'tracksStorageServer',
        'elevationsServer',
        'elevationTileUrl',
    ];
    for (const key of keys) {
        assert.isString(config[key], key);
        assert.match(config[key], /^https:\/\/[a-z0-9-]+\.nakarte-routing\.workers\.dev(\/|$)/u, key);
    }
    for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'string') {
            assert.notMatch(value, AUTHOR_HOST, key);
        }
    }
});

test('no events log and no sentry', function () {
    assert.strictEqual(config.eventsLogUrl, '');
    assert.strictEqual(config.sentryDSN, '');
});

test('caption links to the fork', function () {
    assert.notMatch(config.caption, AUTHOR_HOST);
    assert.include(config.caption, 'https://github.com/sergeycw/nakarte');
});

test('elevation data attribution', function () {
    assert.include(config.elevationsAttribution, 'https://viewfinderpanoramas.org/dem3.html');
});
