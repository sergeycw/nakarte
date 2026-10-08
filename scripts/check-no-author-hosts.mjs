// Ищет адреса инфраструктуры автора (nakarte.me и поддомены) в собранном бандле и падает, если нашёл
// что-то кроме известных строк-метаданных. Запуск: node scripts/check-no-author-hosts.mjs [build].
// Шаг деплоя в .github/workflows/deploy-pages.yml; решение и список метаданных —
// openspec/changes/archive/*-drop-author-services/design.md.
import {readdir, readFile} from 'node:fs/promises';
import {extname, join, relative} from 'node:path';

const ROOT = process.argv[2] ?? 'build';
// Текстовые файлы, которые грузит браузер. Карты исходников (.map) не запрашиваются и содержат
// комментарии исходников, jar и тайлы — двоичные.
const TEXT_EXTENSIONS = new Set(['.js', '.html', '.css', '.json', '.txt', '.webmanifest', '.svg']);
// Буквальный адрес: регулярные выражения разбора ссылок в бандле экранированы (nakarte\.me) и сюда не попадают.
const AUTHOR_HOST = /(?:[a-z0-9-]+\.)*nakarte\.me/giu;
// Строки nakarte.me, которые не являются запросами; переименование продукта — отдельная задача.
const ALLOWED = [
    // <title> в src/index.html
    /<title>nakarte\.me<\/title>/gu,
    // creator в GPX (geo_file_exporters.js); в бандле кавычки могут быть экранированы
    /creator=\\?"http:\/\/nakarte\.me\\?"/gu,
    // префикс имени файла JNX (leaflet.control.jnx)
    /nakarte\.me_/gu,
    // текст уведомления сессий (leaflet.control.sessions)
    /[Ss]witch nakarte\.me window/gu,
];
const CONTEXT_CHARS = 60;

async function* walk(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walk(path);
        } else if (TEXT_EXTENSIONS.has(extname(entry.name))) {
            yield path;
        }
    }
}

function allowedSpans(text) {
    const spans = [];
    for (const pattern of ALLOWED) {
        for (const match of text.matchAll(pattern)) {
            spans.push([match.index, match.index + match[0].length]);
        }
    }
    return spans;
}

function findAuthorHosts(text) {
    const spans = allowedSpans(text);
    const found = [];
    for (const match of text.matchAll(AUTHOR_HOST)) {
        const start = match.index;
        const end = start + match[0].length;
        if (spans.some(([spanStart, spanEnd]) => start >= spanStart && end <= spanEnd)) {
            continue;
        }
        const context = text
            .slice(Math.max(0, start - CONTEXT_CHARS), end + CONTEXT_CHARS)
            .replace(/\s+/gu, ' ');
        found.push({host: match[0], offset: start, context});
    }
    return found;
}

let total = 0;
let files = 0;
for await (const path of walk(ROOT)) {
    files += 1;
    for (const {host, offset, context} of findAuthorHosts(await readFile(path, 'utf8'))) {
        total += 1;
        console.log(`${relative(process.cwd(), path)}:${offset}: ${host}\n    …${context}…`);
    }
}

if (files === 0) {
    console.error(`no text files in ${ROOT}: build first`);
    process.exit(2);
}
if (total > 0) {
    console.error(`\n${total} author host reference(s) in ${files} files`);
    process.exit(1);
}
console.log(`no author hosts in ${files} files of ${ROOT}`);
