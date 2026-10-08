import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Две части: unit в Node (*.test.ts) и то, чему нужен браузер, — в Chromium (*.browser.test.ts[x]).
// В сеть тесты не ходят: тайлы — фикстура из src/test/.
export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            projects: [
                {
                    extends: true,
                    test: {
                        name: 'unit',
                        environment: 'node',
                        include: ['src/**/*.test.ts', 'vite/**/*.test.ts'],
                        exclude: [...configDefaults.exclude, '**/*.browser.test.*'],
                    },
                },
                {
                    extends: true,
                    test: {
                        name: 'browser',
                        include: ['src/**/*.browser.test.{ts,tsx}'],
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
