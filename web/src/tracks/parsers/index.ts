import { type GeoData, geoData } from '../model';
import { parseGeojson } from './geojson';
import { parseGpx } from './gpx';
import { parseKml, parseKmz } from './kml';
import { parseOziPlt, parseOziRte, parseOziWpt } from './ozi';
import { unzip } from './zip-entries';

// Формат файла — по содержимому, а не по расширению: парсеры по очереди, как parsers/index.js старого клиента;
// каждый отвечает null, если файл не его формата.

type Parser = (bytes: Uint8Array, name: string) => GeoData[] | null;

// Внутри ZIP молча пропускаются документы, картинки и каталоги — их кладут рядом с треками
const ZIP_SKIPPED = /(\.(pdf|doc|txt|jpg))|\/$/iu;

function parseZip(bytes: Uint8Array): GeoData[] | null {
    const entries = unzip(bytes);
    if (!entries) {
        return null;
    }
    return entries.flatMap((entry) =>
        parseGeoFile(entry.name, entry.data).filter(
            (item) => !(item.error === 'UNSUPPORTED' && ZIP_SKIPPED.test(item.name)),
        ),
    );
}

const PARSERS: Parser[] = [parseKmz, parseZip, parseGpx, parseOziRte, parseOziPlt, parseOziWpt, parseKml, parseGeojson];

export function parseGeoFile(name: string, bytes: Uint8Array): GeoData[] {
    for (const parser of PARSERS) {
        const parsed = parser(bytes, name);
        if (parsed !== null) {
            return parsed;
        }
    }
    return [geoData(name, { error: 'UNSUPPORTED' })];
}
