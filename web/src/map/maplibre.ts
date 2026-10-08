import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre 6 ищет воркер через new URL(<переменная>, import.meta.url), а бандлер такой путь не видит:
// без setWorkerUrl карта падает с «Worker failed to load» и в dev, и в сборке. Способ для Vite —
// раздел Installation документации MapLibre (?worker&url). Библиотека грузится лениво отдельным чанком,
// react-maplibre принимает промис через mapLib.
export const maplibre = import('maplibre-gl').then((lib) => {
    lib.setWorkerUrl(workerUrl);
    return lib;
});
