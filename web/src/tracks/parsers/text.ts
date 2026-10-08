// Байты файла → текст. Старый клиент читал файлы двоичной строкой и раскодировал названия из UTF-8 всегда, поэтому
// GPX и KML в Windows-1251 с честным encoding= давали испорченные названия. Здесь кодировка берётся из объявления XML
// (design add-web-tracks, «Парсеры»); TextDecoder знает windows-1251, koi8-r, ibm866 и др. по меткам WHATWG.

const UTF8_BOM = [0xef, 0xbb, 0xbf];

export function hasUtf8Bom(bytes: Uint8Array): boolean {
    return UTF8_BOM.every((byte, i) => bytes[i] === byte);
}

export function decode(bytes: Uint8Array, encoding = 'utf-8'): string {
    let decoder: TextDecoder;
    try {
        decoder = new TextDecoder(encoding);
    } catch {
        // метка, которой нет в WHATWG Encoding, — как без объявления
        decoder = new TextDecoder('utf-8');
    }
    // BOM снимается сам только у UTF-8; у остальных кодировок его не бывает
    return decoder.decode(bytes);
}

// Кодировка из <?xml … encoding="…"?> в начале файла; объявление всегда в ASCII-совместимых байтах
export function xmlEncoding(bytes: Uint8Array): string {
    if (hasUtf8Bom(bytes)) {
        return 'utf-8';
    }
    const head = String.fromCharCode(...bytes.subarray(0, 200));
    const match = /^\s*<\?xml[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/u.exec(head);
    return match ? match[1].toLowerCase() : 'utf-8';
}

export function decodeXml(bytes: Uint8Array): string {
    return decode(bytes, xmlEncoding(bytes));
}

// Начинаются ли байты с этой ASCII-строки (после BOM UTF-8, если он есть)
export function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
    const offset = hasUtf8Bom(bytes) ? UTF8_BOM.length : 0;
    for (let i = 0; i < prefix.length; i++) {
        if (bytes[offset + i] !== prefix.charCodeAt(i)) {
            return false;
        }
    }
    return true;
}
