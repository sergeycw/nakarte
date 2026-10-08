import config from '~/config';
import {isRoutingConfigured, routerDownHint, routerDownStatus} from '~/lib/brouter';

// Доступность прокладки и тексты при недоступном роутере зависят от routingEngine, а не от того,
// задан ли routingServer: в клоне он остаётся неиспользуемым значением по умолчанию.
suite('routing engine availability');

let saved;

beforeEach(function () {
    saved = {routingEngine: config.routingEngine, routingServer: config.routingServer};
});

afterEach(function () {
    Object.assign(config, saved);
});

test('browser engine is available without a routing server', function () {
    Object.assign(config, {routingEngine: 'browser', routingServer: ''});
    assert.isTrue(isRoutingConfigured());
});

test('server engine needs a routing server', function () {
    Object.assign(config, {routingEngine: 'server', routingServer: ''});
    assert.isFalse(isRoutingConfigured());
    config.routingServer = 'http://localhost:17777';
    assert.isTrue(isRoutingConfigured());
});

test('browser engine failure does not suggest yarn local', function () {
    config.routingEngine = 'browser';
    assert.notInclude(routerDownHint(), 'yarn local');
    assert.notInclude(routerDownStatus(), 'not running');
});

test('server engine failure suggests yarn local', function () {
    config.routingEngine = 'server';
    assert.include(routerDownHint(), 'yarn local');
    assert.include(routerDownStatus(), 'not running');
});
