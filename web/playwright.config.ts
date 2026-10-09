import { defineConfig, devices } from '@playwright/test';

// e2e против собранного приложения (vite preview отдаёт build/ от корня, как Pages на проде).
// Сборка — до запуска: npm run build && npm run e2e. В сеть тесты не ходят — e2e/fixtures.ts.
const BASE_URL = 'http://localhost:4173/';

export default defineConfig({
    testDir: 'e2e',
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? 'github' : 'list',
    use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: { command: 'npx vite preview', url: BASE_URL, reuseExistingServer: !process.env.CI },
});
