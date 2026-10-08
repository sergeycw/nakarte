import { readFileSync } from 'node:fs';
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

// Фикстура байтами: `import data from './x.zip?bytes'` даёт base64 файла (src/test/bytes.ts раскодирует). ?raw портит
// двоичные файлы (читает как UTF-8), а ?inline Vite отдаёт только для известных типов ассетов, не для .gpx/.plt/.kmz.
function fixtureBytes(): Plugin {
    return {
        name: 'test-fixture-bytes',
        enforce: 'pre',
        load(id) {
            if (!id.endsWith('?bytes')) {
                return null;
            }
            const base64 = readFileSync(id.slice(0, -'?bytes'.length)).toString('base64');
            return `export default ${JSON.stringify(base64)};`;
        },
    };
}

// Две части: unit в Node (*.test.ts) и то, чему нужен браузер, — в Chromium (*.browser.test.ts[x]).
// В сеть тесты не ходят: тайлы — фикстура из src/test/.
export default mergeConfig(
    viteConfig,
    defineConfig({
        plugins: [fixtureBytes()],
        test: {
            projects: [
                {
                    extends: true,
                    test: {
                        name: 'unit',
                        environment: 'node',
                        include: ['src/**/*.test.ts', 'vite/**/*.test.ts'],
                        exclude: [...configDefaults.exclude, '**/*.browser.test.*'],
                        // DOMParser браузера для парсеров треков (design add-web-tracks, «Парсеры»)
                        setupFiles: ['src/test/node-dom.ts'],
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
                            '@base-ui/react/menu',
                            '@base-ui/react/popover',
                            '@base-ui/react/radio',
                            '@base-ui/react/radio-group',
                            'blueimp-md5',
                            'fflate',
                            'lucide-react',
                            'pbf',
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
