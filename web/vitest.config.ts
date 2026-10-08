import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Две части: unit в Node (*.test.ts) и компоненты на настоящей карте в Chromium (*.browser.test.tsx).
// В сеть тесты не ходят: тайлы — фикстура из src/test/.
export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            projects: [
                {
                    extends: true,
                    test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
                },
                {
                    extends: true,
                    test: {
                        name: 'browser',
                        include: ['src/**/*.browser.test.tsx'],
                        browser: {
                            enabled: true,
                            provider: playwright(),
                            headless: true,
                            instances: [{ browser: 'chromium' }],
                        },
                    },
                },
            ],
        },
    }),
);
