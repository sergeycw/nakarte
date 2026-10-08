import { expect, test } from './fixtures.ts';

// Названия тестов — сценарии спеки browser-routing-engine (openspec/specs/browser-routing-engine/spec.md).
// Настоящий движок e2e не запускает: рантайм CheerpJ живёт на CDN, а тесты в сеть не ходят.

test('Прокладка выключена', async ({ page, network }) => {
    const engineRequests: string[] = [];
    page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.hostname.endsWith('leaningtech.com') || /^\/(brouter-wasm|tiles)\//.test(url.pathname)) {
            engineRequests.push(request.url());
        }
    });
    await page.goto('./');
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect.poll(() => network.osmTiles.length).toBeGreaterThan(0);
    expect(engineRequests).toEqual([]);
    expect(page.workers().map((worker) => worker.url())).not.toContainEqual(expect.stringContaining('engine.worker'));
});
