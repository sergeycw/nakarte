import { strToU8, zipSync } from 'fflate';
import { splitLinesAt180 } from './geometry';
import type { LatLng, TrackData, Waypoint } from './model';

// Экспорт треков (geo_file_exporters.js и exportTrackAsFile старого клиента): GPX 1.1, KML 2.2, ZIP из GPX. Строки —
// обычные строки JS: в UTF-8 их переводит Blob при сохранении (старый клиент кодировал вручную через двоичную строку).

export interface ExportedFile {
    filename: string;
    content: string | Uint8Array;
    mimeType: string;
}

export class EmptyTrackError extends Error {
    constructor() {
        super('Track is empty, nothing to save');
    }
}

function escapeXml(text: string): string {
    return text
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;')
        .replace(/'/gu, '&#39;');
}

const coord = (value: number) => value.toFixed(6);

// Высоты GPX с высотами: по одной на точку трека и на точку отрезков, null — без <ele> (точка без данных у API высот)
export interface GpxElevations {
    points: readonly (number | null)[];
    segments: readonly (readonly (number | null)[])[];
}

// <ele> с одним знаком, как saveGpx(…, withElevations) старого клиента
const ele = (value: number | null | undefined) =>
    value === null || value === undefined ? '' : `<ele>${value.toFixed(1)}</ele>`;

export function toGpx(
    name: string,
    segments: readonly (readonly LatLng[])[],
    points: readonly Waypoint[],
    elevations?: GpxElevations,
): string {
    // time у точек трека ничего не значит: без него Garmin Connect не принимал файл (комментарий старого клиента)
    const fakeTime = '1970-01-01T00:00:01.000Z';
    const gpx = [
        '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
        '<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="nakarte-routing" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 ' +
            'http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1">',
        '\t<metadata>',
        `\t\t<time>${new Date().toISOString()}</time>`,
        '\t</metadata>',
    ];
    points.forEach((point, i) => {
        gpx.push(`\t<wpt lat="${coord(point.lat)}" lon="${coord(point.lng)}">`);
        // порядок элементов wpt по схеме GPX 1.1: ele раньше name
        const height = ele(elevations?.points[i]);
        if (height) {
            gpx.push(`\t\t${height}`);
        }
        gpx.push(`\t\t<name>${escapeXml(point.name)}</name>`);
        gpx.push('\t</wpt>');
    });
    if (segments.length) {
        gpx.push('\t<trk>');
        gpx.push(`\t\t<name>${escapeXml(name || 'Track')}</name>`);
        segments.forEach((segment, k) => {
            gpx.push('\t\t<trkseg>');
            segment.forEach((point, i) => {
                const height = ele(elevations?.segments[k]?.[i]);
                gpx.push(
                    `\t\t\t<trkpt lat="${coord(point.lat)}" lon="${coord(point.lng)}">${height}<time>${fakeTime}</time></trkpt>`,
                );
            });
            gpx.push('\t\t</trkseg>');
        });
        gpx.push('\t</trk>');
    }
    gpx.push('</gpx>');
    return gpx.join('\n');
}

export function toKml(name: string, segments: readonly (readonly LatLng[])[], points: readonly Waypoint[]): string {
    const kml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '\t<Document>',
        `\t\t<name>${escapeXml(name || 'Track')}</name>`,
    ];
    segments.forEach((segment, i) => {
        kml.push('\t\t<Placemark>', `\t\t\t<name>Line ${i + 1}</name>`, '\t\t\t<LineString>');
        kml.push('\t\t\t\t<tessellate>1</tessellate>', '\t\t\t\t<coordinates>');
        for (const point of segment) {
            kml.push(`\t\t\t\t\t${coord(point.lng)},${coord(point.lat)}`);
        }
        kml.push('\t\t\t\t</coordinates>', '\t\t\t</LineString>', '\t\t</Placemark>');
    });
    for (const point of points) {
        kml.push('\t\t<Placemark>', `\t\t\t<name>${escapeXml(point.name)}</name>`, '\t\t\t<Point>');
        kml.push(`\t\t\t\t<coordinates>${coord(point.lng)},${coord(point.lat)},0</coordinates>`);
        kml.push('\t\t\t</Point>', '\t\t</Placemark>');
    }
    kml.push('\t</Document>', '</kml>');
    return kml.join('\n');
}

// splitExtensionsFirstStage и splitExtensions старого клиента: «track.gpx» → «track», «track.gpx.xml» → «track»
const EXTENSION_STAGES = [
    ['xml', 'txt', 'html', 'php', 'tmp', 'gz'],
    ['gpx', 'kml', 'geojson', 'kmz', 'wpt', 'rte', 'plt', 'fit', 'tmp', 'jpg', 'crdownload'],
];

export function fileBaseName(trackName: string): string {
    // браузер (Chrome) срезает точку в начале имени, а на Linux это скрытый файл
    let name = trackName.replace(/^\./u, '_');
    for (const extensions of EXTENSION_STAGES) {
        const dot = name.lastIndexOf('.');
        if (dot > -1 && extensions.includes(name.slice(dot + 1).toLowerCase())) {
            name = name.slice(0, dot);
        }
    }
    return name;
}

type Format = 'gpx' | 'kml';

const FORMATS: Record<Format, { write: typeof toGpx; mimeType: string }> = {
    gpx: { write: toGpx, mimeType: 'application/gpx+xml' },
    kml: { write: toKml, mimeType: 'application/vnd.google-earth.kml+xml' },
};

// Пустой трек — EmptyTrackError, кроме ZIP (allowEmpty): там пустой трек тоже файл, как у старого клиента
export function exportTrack(track: TrackData, format: Format, allowEmpty = false): ExportedFile {
    const segments = splitLinesAt180(track.segments);
    if (!allowEmpty && segments.length === 0 && track.points.length === 0) {
        throw new EmptyTrackError();
    }
    const name = fileBaseName(track.name);
    const { write, mimeType } = FORMATS[format];
    return { filename: `${name}.${format}`, content: write(name, segments, track.points), mimeType };
}

// GPX с высотами (exportTrackAsFile старого клиента с addElevations): высоты всех точек трека и отрезков — без выборки,
// после деления у 180°, как в файле. elevations — запрос к API высот (elevation/api.ts); его ошибка уходит наверх, файла
// нет (у старого после уведомления падал TypeError). Пустой трек — EmptyTrackError без запроса.
export async function exportGpxWithElevations(
    track: TrackData,
    elevations: (points: readonly LatLng[]) => Promise<(number | null)[]>,
): Promise<ExportedFile> {
    const segments = splitLinesAt180(track.segments);
    if (segments.length === 0 && track.points.length === 0) {
        throw new EmptyTrackError();
    }
    const values = await elevations([...track.points, ...segments.flat()]);
    let next = track.points.length;
    const heights: GpxElevations = {
        points: values.slice(0, next),
        segments: segments.map((segment) => {
            next += segment.length;
            return values.slice(next - segment.length, next);
        }),
    };
    const name = fileBaseName(track.name);
    return {
        filename: `${name}.gpx`,
        content: toGpx(name, segments, track.points, heights),
        mimeType: FORMATS.gpx.mimeType,
    };
}

function uniqueName(name: string, seen: Set<string>): string {
    let unique = name;
    for (let i = 1; seen.has(unique); i++) {
        unique = `${name}(${i})`;
    }
    seen.add(unique);
    return unique;
}

const pad = (value: number) => String(value).padStart(2, '0');

// saveAllTracksToZipFile старого клиента; месяц — с единицы (у старого getMonth() давал январь «00»)
export function exportZip(tracks: readonly TrackData[], now = new Date()): ExportedFile {
    const seen = new Set<string>();
    const files: Record<string, Uint8Array> = {};
    for (const track of tracks) {
        const { content } = exportTrack(track, 'gpx', true);
        const name = uniqueName(fileBaseName(track.name).replace(/[<>:"/\\|?*]/gu, '_'), seen);
        files[`${name}.gpx`] = strToU8(content as string);
    }
    const date =
        `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}` +
        `_${pad(now.getHours())}.${pad(now.getMinutes())}`;
    return { filename: `nakarte_tracks_${date}.zip`, content: zipSync(files), mimeType: 'application/zip' };
}

// Сохранение файла: ссылка с download на Blob
export function saveFile({ filename, content, mimeType }: ExportedFile): void {
    const url = URL.createObjectURL(new Blob([content as BlobPart], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
