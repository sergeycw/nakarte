// Импорт фикстуры байтами — плагин fixtureBytes в vitest.config.ts
declare module '*?bytes' {
    const base64: string;
    export default base64;
}
