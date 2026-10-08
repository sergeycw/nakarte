import { normalizeLine } from './geometry';
import { type GeoData, isEmpty } from './model';

// Что из загруженного попадает в список и какие сообщения показать (addTracksFromGeodataArray старого клиента;
// тексты — спека track-files, «Сообщение об ошибке источника»).

const ERROR_MESSAGES: Record<string, string> = {
    CORRUPT: 'File "{name}" is corrupt',
    UNSUPPORTED: 'File "{name}" has unsupported format or is badly corrupt',
    NETWORK: 'Could not download file from url "{name}"',
    INVALID_URL: '"{name}" is not of supported URL type',
};

export interface ImportResult {
    tracks: GeoData[];
    messages: string[];
}

// allowEmpty — пустой трек тоже добавить («New track»)
export function prepareImport(data: readonly GeoData[], allowEmpty = false): ImportResult {
    const result: ImportResult = { tracks: [], messages: [] };
    if (data.length === 0) {
        result.messages.push('No tracks loaded');
    }
    for (const item of data) {
        const empty = isEmpty(item);
        if (!empty || allowEmpty) {
            result.tracks.push({ ...item, segments: item.segments.map(normalizeLine) });
        }
        let message: string | undefined;
        if (item.error) {
            message = ERROR_MESSAGES[item.error] ?? item.error;
            message += empty ? ', no data could be loaded' : ', loaded data can be invalid or incomplete';
        } else if (empty && !allowEmpty) {
            message = 'No data could be loaded from file "{name}". File is empty or contains only unsupported data.';
        }
        if (message) {
            result.messages.push(message.replaceAll('{name}', item.name));
        }
    }
    return result;
}
