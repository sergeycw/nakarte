import { describe, expect, test } from 'vitest';
import { makeConfig } from './config';

describe('Адреса сервисов клона', () => {
    test('Сборка клона', () => {
        const config = makeConfig('clone');
        expect(config.routingEngine).toBe('browser');
        expect(config.routingTilesPath).toBe('/tiles/');
        for (const url of [config.corsProxyUrl, config.tracksStorageServer, config.elevationsServer]) {
            expect(new URL(url).hostname).toMatch(/\.nakarte-routing\.workers\.dev$/);
        }
    });

    test('Локальная сборка', () => {
        const local = makeConfig('development');
        const clone = makeConfig('clone');
        expect(local.routingEngine).toBe('server');
        expect(makeConfig('production').routingEngine).toBe('server');
        expect(local.corsProxyUrl).toBe(clone.corsProxyUrl);
        expect(local.tracksStorageServer).toBe(clone.tracksStorageServer);
        expect(local.elevationsServer).toBe(clone.elevationsServer);
    });

    test('Рантайм движка с CDN Leaning Technologies', () => {
        for (const mode of ['clone', 'development']) {
            expect(new URL(makeConfig(mode).routingEngineRuntimeUrl).origin).toBe('https://cjrtnc.leaningtech.com');
        }
    });

    test('Адрес автора', () => {
        for (const mode of ['clone', 'development', 'production']) {
            expect(JSON.stringify(makeConfig(mode))).not.toMatch(/nakarte\.me/);
        }
    });
});
