// Покрытие Street View — тайлы Google без ключа (getCoverageLayer старого клиента,
// src/lib/leaflet.control.panoramas/lib/google/index.js): 256 px, CORS * (проверено curl 2026-10-09). Модуль без
// импортов: его читает и e2e-фикстура сети (e2e собирается как Node-модуль).

export const COVERAGE_CODE = 'street-view-coverage';
export const COVERAGE_TITLE = 'Street View coverage';
export const COVERAGE_TILES =
    'https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e3*212b1*213e2*211m3*211e2*212b1*213e2!3m5!3sUS!12m1!1e40!12m1!1e18!4e0';
