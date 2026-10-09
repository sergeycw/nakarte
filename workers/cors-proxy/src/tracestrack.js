// Тайлы Tracestrack Topo — подложки по умолчанию приложения (слой Tt в web/src/layers/catalog.ts). Ключ API —
// секрет Worker'а TRACESTRACK_KEY: в бандле и в адресе клиента его нет (design add-outdoor-basemap).

export const TRACESTRACK_HOST = 'tile.tracestrack.com';

// Ключ тратится только на растр, который показывает приложение: topo__ — карта без перевода подписей, как у
// openstreetmap.org; @2x — тайл повышенной плотности того же кредита. Векторные тайлы и API высот Tracestrack стоят
// по 6 кредитов, и через прокси с поддельным Origin их звали бы чужие — такие адреса уходят без ключа.
const TILE_PATH = /^\/topo__\/\d+\/\d+\/\d+(@2x)?\.webp$/u;

// Без Cache-Control у ответа браузер перезапрашивал бы тайлы на каждом заходе, а каждый успешный тайл — кредит
// бесплатной квоты (100 тыс. в месяц). Свой заголовок Tracestrack, если он есть, не трогаем.
const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';

// Только https на стандартный порт: /http/… или чужой порт с поддельным Origin увели бы ключ открытым текстом или
// не туда
export function isTracestrackTile(target) {
    const url = new URL(target);
    return (
        url.protocol === 'https:' && url.port === '' && url.hostname === TRACESTRACK_HOST && TILE_PATH.test(url.pathname)
    );
}

// Запрос клиента после пути отбрасывается целиком: в нём мог оказаться чужой key, а другие параметры тайлу не нужны
export function withKey(target, key) {
    const url = new URL(target);
    url.search = '';
    url.searchParams.set('key', key);
    return url.href;
}

// Заголовки ответа на тайл — по белому списку: что Tracestrack кладёт в остальные (Link, Content-Location, отладочные),
// без ключа не проверить, а ключ в них ушёл бы клиенту. Location прокси ставит сам (withoutKey)
const RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified', 'expires'];

export function responseHeaders(upstream) {
    const headers = new Headers();
    for (const name of RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) {
            headers.set(name, value);
        }
    }
    if (upstream.status === 200 && !headers.has('cache-control')) {
        headers.set('cache-control', DEFAULT_CACHE_CONTROL);
    }
    return headers;
}

// Тело ошибки Tracestrack клиенту не уходит: текст вида «key … exceeded quota» мог бы повторить ключ. Клиенту хватает
// статуса — по нему он откатывается на OSM
export function errorBody(status) {
    return `Tracestrack error ${status}\n`;
}

// Location ответа на тайл уходит клиенту через прокси — без ключа
export function withoutKey(absoluteUrl) {
    const url = new URL(absoluteUrl);
    url.searchParams.delete('key');
    return url.href;
}
