import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Ответ с заданным HTTP-статусом для browser-тестов карты: /__status__/404/… → 404. Dev-сервер на любой
// несуществующий путь отвечает 200 text/html, а тестам нужны честные 404 (тайла нет) и 503 (сервер лёг).
function statusResponses(): Plugin {
    return {
        name: 'test-status-responses',
        configureServer(server) {
            server.middlewares.use('/__status__/', (req, res) => {
                res.statusCode = Number.parseInt(req.url?.split('/')[1] ?? '', 10) || 500;
                res.end();
            });
        },
    };
}

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
                    plugins: [statusResponses()],
                    // зависимости, которые Vite иначе находит уже во время прогона и перезагружает тест
                    // («Vite unexpectedly reloaded a test»): вторая копия React падает с useContext of null.
                    // С холодным кешем (CI) так падает первый файл, который их импортирует.
                    optimizeDeps: {
                        include: [
                            '@base-ui/react/checkbox',
                            '@base-ui/react/dialog',
                            '@base-ui/react/popover',
                            '@base-ui/react/radio',
                            '@base-ui/react/radio-group',
                            'lucide-react',
                            'zustand',
                            'zustand/vanilla',
                        ],
                    },
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
