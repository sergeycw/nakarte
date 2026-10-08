import L from 'leaflet';

import config from '~/config';

import './keyless.css';

// Ключ пустой, когда сборка не получила GOOGLE_MAPS_API_KEY (deploy-pages.yml) или локальный
// src/secrets.js держит google: ''. Тогда контейнер получает класс, под которым keyless.css прячет
// режим разработки Google.
function isGoogleKeyless(apiUrl = config.googleApiUrl) {
    return /[?&]key=(&|$)/u.test(apiUrl);
}

function markKeylessContainer(container, apiUrl = config.googleApiUrl) {
    if (isGoogleKeyless(apiUrl)) {
        L.DomUtil.addClass(container, 'google-street-view-keyless');
    }
}

export {isGoogleKeyless, markKeylessContainer};
