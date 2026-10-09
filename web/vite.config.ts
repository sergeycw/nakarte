import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { engineFiles } from './vite/engine-files.ts';

// Приложение на корне Pages-проекта nakarte-routing (design switch-to-web-app): сборка — весь build/, плагин engineFiles
// докладывает туда файлы движка; /next/ старых ссылок отвечает редиректом из public/_redirects.
export default defineConfig({
    base: '/',
    plugins: [react(), tailwindcss(), engineFiles()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
        outDir: '../build',
        // каталог вне корня проекта Vite без флага не чистит
        emptyOutDir: true,
        // maplibre-gl ≈ 1.1 МБ (≈ 290 КБ gzip) отдельным чанком: react-maplibre грузит его динамическим import()
        chunkSizeWarningLimit: 1200,
        // стенд движка выкатывается рядом с приложением (/engine-bench.html) для проверок на проде
        // (design spike-engine-in-worker); ссылок на него нет, рантайм CheerpJ грузится только при открытии
        rolldownOptions: {
            input: {
                index: fileURLToPath(new URL('./index.html', import.meta.url)),
                bench: fileURLToPath(new URL('./engine-bench.html', import.meta.url)),
            },
        },
    },
    // 8767–8768 — стенд движка experiments/wasm/serve.mjs, 8787–8789 — Worker'ы
    // /tiles/ (тайлы BRouter в режиме clone) — nakarte-tiles-worker;
    // /brouter-wasm/ отдаёт плагин engineFiles
    server: { port: 8769, strictPort: true, proxy: { '/tiles/': 'http://localhost:8788' } },
    preview: { port: 4173, strictPort: true },
});
