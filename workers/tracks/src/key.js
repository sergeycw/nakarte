import md5 from 'blueimp-md5';

export function trackKey(text) {
    return btoa(md5(text, null, true)).replace(/\//gu, '_').replace(/\+/gu, '-').replace(/=/gu, '');
}
