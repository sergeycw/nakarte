import { unzipSync } from 'fflate';

// Записи ZIP с именами в правильной кодировке. fflate раскодирует имя без флага UTF-8 (бит 11) как Latin-1, а архивы
// Windows с кириллицей пишут имена в CP866 (как decode866 старого клиента). Флаг берётся из центрального каталога:
// fflate вызывает filter в порядке его записей, флаги читаются тем же проходом.

export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const UTF8_FLAG = 0x800;

function centralDirectoryFlags(bytes: Uint8Array): boolean[] | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = bytes.length - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== EOCD_SIGNATURE) {
        eocd--;
    }
    if (eocd < 0) {
        return null;
    }
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const flags: boolean[] = [];
    for (let i = 0; i < count && offset + 46 <= bytes.length; i++) {
        if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
            return null;
        }
        flags.push((view.getUint16(offset + 8, true) & UTF8_FLAG) !== 0);
        offset +=
            46 +
            view.getUint16(offset + 28, true) +
            view.getUint16(offset + 30, true) +
            view.getUint16(offset + 32, true);
    }
    return flags;
}

function looksLikeZip(bytes: Uint8Array) {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

// null — не ZIP или архив не читается (метод сжатия кроме stored/deflate, обрезанный файл)
export function unzip(bytes: Uint8Array): ZipEntry[] | null {
    if (!looksLikeZip(bytes)) {
        return null;
    }
    const flags = centralDirectoryFlags(bytes);
    const names: string[] = [];
    let files: Record<string, Uint8Array>;
    try {
        files = unzipSync(bytes, {
            filter: (file) => {
                names.push(file.name);
                return true;
            },
        });
    } catch {
        return null;
    }
    return names.map((raw, i) => ({
        // ZIP64 и прочие архивы, где каталог не прочитался, — имена как отдал fflate
        name: flags && !flags[i] ? new TextDecoder('ibm866').decode(Uint8Array.from(raw, (c) => c.charCodeAt(0))) : raw,
        data: files[raw],
    }));
}
