import type { LatLng } from '@/tracks/model';
import type { Elevation } from './profile';

// Запросы к API высот (спека elevation-api; ElevationProvider старого клиента, src/lib/elevations/index.js): POST
// строк «lat lng» с шестью знаками, ответ — строка на точку, высота или NULL. Куски по 10 000 точек — лимит Worker'а
// (10 000 точек и 250 000 байт: строка не длиннее 23 байт, кусок укладывается), последовательно, как у старого.
// Без credentials, в отличие от старого withCredentials: Worker отражает Origin и без них, cookies ему не нужны
// (design add-web-elevation-profile, «Модули»).

export const ELEVATION_CHUNK = 10000;

export class ElevationError extends Error {}

export interface ElevationSource {
    fetch: typeof fetch;
    url: string;
}

// Долгота для API: вне [-180, 180) у Worker'а NULL (спека elevation-api, «Нет данных»). Долгота в пределах не
// трогается — арифметика приведения даёт ей шум в последнем знаке (как wrapped в tracks/actions.ts), а 180 → -180.
export function requestLng(lng: number): number {
    return lng >= -180 && lng < 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function requestBody(points: readonly LatLng[]): string {
    return points.map((p) => `${p.lat.toFixed(6)} ${requestLng(p.lng).toFixed(6)}`).join('\n');
}

export function parseResponse(text: string, expected: number): Elevation[] {
    if (expected === 0) {
        return [];
    }
    const lines = text.split('\n');
    // хвостового перевода строки у Worker'а нет; если появится — не считать его строкой
    if (lines.length === expected + 1 && lines[expected] === '') {
        lines.pop();
    }
    if (lines.length !== expected) {
        throw new ElevationError('unexpected response');
    }
    return lines.map((line) => {
        if (line === 'NULL') {
            return null;
        }
        const value = Number.parseFloat(line);
        if (!Number.isFinite(value)) {
            throw new ElevationError('unexpected response');
        }
        return value;
    });
}

function statusReason(status: number): string {
    if (status === 429) {
        return 'too many requests, try again in a minute';
    }
    // по числу точек и байтам куски в лимит укладываются, значит — больше 512 чтений хранилища: точки вразброс
    if (status === 413) {
        return 'track covers too large an area';
    }
    return `HTTP ${status}`;
}

export async function fetchElevations(
    points: readonly LatLng[],
    source: ElevationSource,
    signal?: AbortSignal,
): Promise<Elevation[]> {
    const result: Elevation[] = [];
    for (let i = 0; i < points.length; i += ELEVATION_CHUNK) {
        const chunk = points.slice(i, i + ELEVATION_CHUNK);
        let response: Response;
        try {
            response = await source.fetch(source.url, { method: 'POST', body: requestBody(chunk), signal });
        } catch (error) {
            if (signal?.aborted) {
                throw error;
            }
            throw new ElevationError('network error');
        }
        if (!response.ok) {
            throw new ElevationError(statusReason(response.status));
        }
        let text: string;
        try {
            text = await response.text();
        } catch (error) {
            if (signal?.aborted) {
                throw error;
            }
            throw new ElevationError('network error');
        }
        result.push(...parseResponse(text, chunk.length));
    }
    return result;
}

export function errorReason(error: unknown): string {
    return error instanceof ElevationError ? error.message : String(error);
}
