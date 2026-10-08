import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Новое приложение живёт на /next/ того же Pages-проекта, что и старый клиент (design add-web-skeleton).
// Сборка идёт в build/next/ после webpack: его CleanWebpackPlugin чистит весь build/.
export default defineConfig({
    base: '/next/',
    plugins: [react(), tailwindcss()],
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
    server: { port: 8769, strictPort: true },
    preview: { port: 4173, strictPort: true },
});
