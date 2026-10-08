import { PbfReader, PbfWriter } from 'pbf';
import { type GeoData, geoData, type LatLng, type TrackData, type Waypoint } from './model';

// Строка трека nktk (parsers/nktk.js старого клиента): base64url от байтов «версия + данные». Версия — первое
// упакованное число: 1–3 — свой формат упакованных чисел, 4 — protobuf (схема parsers/nktk.proto). Без версии
// (version 0) — ссылки track://. Запись — только версия 4, как saveNktk. На этих строках держатся выданные ссылки
// nktl= и объекты хранилища (аудит системного дизайна, п. 2), поэтому разбор всех версий остаётся навсегда.

// Сетка координат: 2^24 − 1 делений на 360°, ≈ 2.4 м
export const ARC_UNIT = ((1 << 24) - 1) / 360;

const DEFAULT_NAME = 'Text encoded track';

function corrupt(): GeoData[] {
    return [geoData(DEFAULT_NAME, { error: 'CORRUPT' })];
}

// urlSafeBase64.decode старого клиента: пробелы и переводы строк выкидываются, = в конце не обязателен
export function decodeBase64Url(text: string): Uint8Array | null {
    const base64 = text
        .replace(/[\n\r \t]/gu, '')
        .replace(/-/gu, '+')
        .replace(/_/gu, '/');
    let binary: string;
    try {
        binary = atob(base64);
    } catch {
        return null;
    }
    return binary.length ? Uint8Array.from(binary, (char) => char.charCodeAt(0)) : null;
}

// С `=` в конце, как urlSafeBase64.encode старого клиента: тело ссылки nktl совпадает со старым байт в байт
export function encodeBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_');
}

class TruncatedError extends Error {}

// PackedStreamReader: число — 1–4 байта, 7 бит на байт, старший бит — «дальше ещё байт», со смещением к знаковому
class PackedReader {
    position = 0;
    private readonly bytes: Uint8Array;
    constructor(bytes: Uint8Array) {
        this.bytes = bytes;
    }

    private byte(offset: number) {
        const value = this.bytes[this.position + offset];
        if (value === undefined) {
            throw new TruncatedError();
        }
        return value;
    }

    readNumber(): number {
        let x = this.byte(0);
        if (x < 128) {
            this.position += 1;
            return x - 64;
        }
        let n = x & 0x7f;
        x = this.byte(1);
        if (x < 128) {
            this.position += 2;
            return (n | (x << 7)) - 8192;
        }
        n |= (x & 0x7f) << 7;
        x = this.byte(2);
        if (x < 128) {
            this.position += 3;
            return (n | (x << 14)) - 1048576;
        }
        n |= (x & 0x7f) << 14;
        x = this.byte(3);
        this.position += 4;
        return (n | (x << 21)) - 268435456;
    }

    readString(size: number): string {
        if (size < 0 || this.position + size > this.bytes.length) {
            throw new TruncatedError();
        }
        const text = new TextDecoder().decode(this.bytes.subarray(this.position, this.position + size));
        this.position += size;
        return text;
    }

    rest() {
        return this.bytes.subarray(this.position);
    }
}

// parseNktkOld: обрыв строки — CORRUPT с тем, что успело прочитаться (недочитанный отрезок тоже)
function parsePacked(bytes: Uint8Array, version: number): GeoData {
    const reader = new PackedReader(bytes);
    const result = geoData('');
    let truncated = false;
    let segment: LatLng[] | null = null;
    try {
        result.name = reader.readString(reader.readNumber());
        const segmentsCount = reader.readNumber();
        for (let i = 0; i < segmentsCount; i++) {
            segment = [];
            const pointsCount = reader.readNumber();
            let x = 0;
            let y = 0;
            for (let j = 0; j < pointsCount; j++) {
                x += reader.readNumber();
                y += reader.readNumber();
                segment.push({ lat: y / ARC_UNIT, lng: x / ARC_UNIT });
            }
            result.segments.push(segment);
            segment = null;
        }
    } catch (error) {
        if (!(error instanceof TruncatedError)) {
            throw error;
        }
        truncated = true;
        if (segment) {
            result.segments.push(segment);
        }
    }

    if (!truncated) {
        try {
            result.color = reader.readNumber();
            result.measureTicksShown = Boolean(reader.readNumber());
        } catch {
            // версия 0 (track://) могла кончиться на отрезках
            result.color = 0;
            result.measureTicksShown = false;
            truncated = version > 0;
        }
    }
    if (version >= 3 && !truncated) {
        try {
            result.hidden = Boolean(reader.readNumber());
        } catch {
            truncated = true;
        }
    }
    if (version >= 2 && !truncated) {
        try {
            const pointsCount = reader.readNumber();
            const midX = pointsCount ? reader.readNumber() : 0;
            const midY = pointsCount ? reader.readNumber() : 0;
            for (let i = 0; i < pointsCount; i++) {
                const name = reader.readString(reader.readNumber());
                reader.readNumber(); // символ точки, не используется
                const x = reader.readNumber() + midX;
                const y = reader.readNumber() + midY;
                result.points.push({ name, lat: y / ARC_UNIT, lng: x / ARC_UNIT });
            }
        } catch {
            truncated = true;
        }
    }
    // у старого клиента недочитанные цвет и отметки — нули
    result.name ||= DEFAULT_NAME;
    result.color ??= 0;
    result.measureTicksShown ??= false;
    result.hidden ??= false;
    if (truncated) {
        result.error = 'CORRUPT';
    }
    return result;
}

// Протобуф версии 4 — ручной разбор схемы nktk.proto (сгенерированный nktk_pb.js старого клиента, pbf 3)
interface ViewMessage {
    color: number;
    shown: boolean;
    ticksShown: boolean;
}
interface SegmentMessage {
    lats: number[];
    lons: number[];
}
interface WaypointMessage {
    lat: number;
    lon: number;
    name: string;
}
interface WaypointsMessage {
    midLat: number;
    midLon: number;
    waypoints: WaypointMessage[];
}
interface TrackMessage {
    name: string;
    segments: SegmentMessage[];
    waypoints: WaypointsMessage | null;
}

function readMessage<T>(pbf: PbfReader, init: T, read: (tag: number, obj: T, pbf: PbfReader) => void): T {
    return pbf.readFields(read, init, pbf.readVarint() + pbf.pos);
}

function readSegment(tag: number, obj: SegmentMessage, pbf: PbfReader) {
    if (tag === 1) pbf.readPackedSVarint(obj.lats);
    else if (tag === 2) pbf.readPackedSVarint(obj.lons);
}

function readWaypoint(tag: number, obj: WaypointMessage, pbf: PbfReader) {
    if (tag === 1) obj.lat = pbf.readSVarint();
    else if (tag === 2) obj.lon = pbf.readSVarint();
    else if (tag === 3) obj.name = pbf.readString();
}

function readWaypoints(tag: number, obj: WaypointsMessage, pbf: PbfReader) {
    if (tag === 1) obj.midLat = pbf.readSVarint();
    else if (tag === 2) obj.midLon = pbf.readSVarint();
    else if (tag === 3) obj.waypoints.push(readMessage(pbf, { lat: 0, lon: 0, name: '' }, readWaypoint));
}

function readTrack(tag: number, obj: TrackMessage, pbf: PbfReader) {
    if (tag === 1) obj.name = pbf.readString();
    else if (tag === 2) obj.segments.push(readMessage(pbf, { lats: [], lons: [] }, readSegment));
    else if (tag === 3) obj.waypoints = readMessage(pbf, { midLat: 0, midLon: 0, waypoints: [] }, readWaypoints);
}

function readView(tag: number, obj: ViewMessage, pbf: PbfReader) {
    if (tag === 1) obj.color = pbf.readVarint(true);
    else if (tag === 2) obj.shown = pbf.readBoolean();
    else if (tag === 3) obj.ticksShown = pbf.readBoolean();
}

function deltaDecode(lats: number[], lons: number[]): LatLng[] {
    const points: LatLng[] = [];
    let lat = 0;
    let lng = 0;
    for (let i = 0; i < lats.length; i++) {
        lat += lats[i];
        lng += lons[i];
        points.push({ lat: lat / ARC_UNIT, lng: lng / ARC_UNIT });
    }
    return points;
}

function parseProtobuf(bytes: Uint8Array): GeoData[] {
    let view: ViewMessage | null = null;
    let track: TrackMessage | null = null;
    try {
        new PbfReader(bytes).readFields((tag, _, pbf) => {
            if (tag === 1) view = readMessage(pbf, { color: 0, shown: false, ticksShown: false }, readView);
            else if (tag === 2) track = readMessage(pbf, { name: '', segments: [], waypoints: null }, readTrack);
        }, null);
    } catch {
        return corrupt();
    }
    // у старого клиента без track или view разбор падал исключением
    const v = view as ViewMessage | null;
    const t = track as TrackMessage | null;
    if (!v || !t) {
        return corrupt();
    }
    const result = geoData(t.name || DEFAULT_NAME, {
        color: v.color,
        hidden: !v.shown,
        measureTicksShown: v.ticksShown,
        segments: t.segments.map((segment) => deltaDecode(segment.lats, segment.lons)),
    });
    const waypoints = t.waypoints;
    if (waypoints) {
        result.points = waypoints.waypoints.map((point) => ({
            name: point.name,
            lat: (point.lat + waypoints.midLat) / ARC_UNIT,
            lng: (point.lon + waypoints.midLon) / ARC_UNIT,
        }));
    }
    return [result];
}

// Одна строка nktk с версией (параметр nktk=, элемент тела nktl)
export function parseNktk(text: string): GeoData[] {
    const bytes = decodeBase64Url(text);
    if (!bytes) {
        return corrupt();
    }
    const reader = new PackedReader(bytes);
    let version: number;
    try {
        version = reader.readNumber();
    } catch {
        return corrupt();
    }
    if (version >= 1 && version <= 3) {
        return [parsePacked(reader.rest(), version)];
    }
    if (version === 4) {
        return parseProtobuf(reader.rest());
    }
    return corrupt();
}

// Строки через `/` — тело хранилища nktl и несколько треков в nktk=
export function parseNktkSequence(text: string): GeoData[] {
    return text.split('/').flatMap(parseNktk);
}

// track://… — версия 0 без номера версии
export function parseTrackUrlData(text: string): GeoData[] {
    const bytes = decodeBase64Url(text);
    return bytes ? [parsePacked(bytes, 0)] : corrupt();
}

function deltaEncode(points: readonly LatLng[]) {
    const lats: number[] = [];
    const lons: number[] = [];
    let lastLat = 0;
    let lastLon = 0;
    for (const point of points) {
        const lat = Math.round(point.lat * ARC_UNIT);
        const lon = Math.round(point.lng * ARC_UNIT);
        lats.push(lat - lastLat);
        lons.push(lon - lastLon);
        lastLat = lat;
        lastLon = lon;
    }
    return { lats, lons };
}

function writeWaypoints(points: readonly Waypoint[], pbf: PbfWriter) {
    let midLat = 0;
    let midLon = 0;
    for (const point of points) {
        midLat += point.lat;
        midLon += point.lng;
    }
    midLat = Math.round((midLat * ARC_UNIT) / points.length);
    midLon = Math.round((midLon * ARC_UNIT) / points.length);
    if (midLat) pbf.writeSVarintField(1, midLat);
    if (midLon) pbf.writeSVarintField(2, midLon);
    for (const point of points) {
        pbf.writeMessage(
            3,
            (p: Waypoint, out: PbfWriter) => {
                const lat = Math.round(p.lat * ARC_UNIT) - midLat;
                const lon = Math.round(p.lng * ARC_UNIT) - midLon;
                if (lat) out.writeSVarintField(1, lat);
                if (lon) out.writeSVarintField(2, lon);
                if (p.name) out.writeStringField(3, p.name);
            },
            point,
        );
    }
}

// saveNktk старого клиента: версия 4; пустые поля не пишутся, как в сгенерированном коде pbf
export function saveNktk(track: TrackData): string {
    const pbf = new PbfWriter();
    pbf.writeMessage(
        1,
        (_: null, out: PbfWriter) => {
            if (track.color) out.writeVarintField(1, track.color);
            if (!track.hidden) out.writeBooleanField(2, true);
            if (track.measureTicksShown) out.writeBooleanField(3, true);
        },
        null,
    );
    pbf.writeMessage(
        2,
        (_: null, out: PbfWriter) => {
            if (track.name) out.writeStringField(1, track.name);
            for (const segment of track.segments) {
                out.writeMessage(
                    2,
                    ({ lats, lons }: SegmentMessage, segmentOut: PbfWriter) => {
                        segmentOut.writePackedSVarint(1, lats);
                        segmentOut.writePackedSVarint(2, lons);
                    },
                    deltaEncode(segment),
                );
            }
            if (track.points.length) {
                out.writeMessage(3, writeWaypoints, track.points);
            }
        },
        null,
    );
    const body = pbf.finish();
    const bytes = new Uint8Array(body.length + 1);
    bytes[0] = 4 + 64;
    bytes.set(body, 1);
    return encodeBase64Url(bytes);
}
