// Байты фикстуры из импорта `?bytes` (плагин fixtureBytes в vitest.config.ts)
export function fixtureBytes(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
