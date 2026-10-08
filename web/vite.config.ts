import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { engineFiles } from './vite/engine-files.ts';

// Новое приложение живёт на /next/ того же Pages-проекта, что и старый клиент (design add-web-skeleton).
// Сборка идёт в build/next/ после webpack: его CleanWebpackPlugin чистит весь build/.
export default defineConfig({
    base: '/next/',
    plugins: [react(), tailwindcss(), engineFiles()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
        outDir: '../build/next',
        // каталог вне корня проекта Vite без флага не чистит
        emptyOutDir: true,
        // maplibre-gl ≈ 1.1 МБ (≈ 290 КБ gzip) отдельным чанком: react-maplibre грузит его динамическим import()
        chunkSizeWarningLimit: 1200,
    },
    // 8765–8768 заняты старым клиентом и стендом движка, 8787–8789 — Worker'ы
    // /tiles/ (тайлы BRouter в режиме clone) — nakarte-tiles-worker, как у старого dev-сервера;
    // /brouter-wasm/ отдаёт плагин engineFiles
    server: { port: 8769, strictPort: true, proxy: { '/tiles/': 'http://localhost:8788' } },
    preview: { port: 4173, strictPort: true },
});
