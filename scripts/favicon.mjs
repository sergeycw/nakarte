// Иконки сайта из web/public/favicon.svg (change site-favicon): favicon.ico с картинками 16, 32 и 48 px для браузеров
// без SVG-иконок и apple-touch-icon.png 180 px для iOS. iOS сам скругляет углы и не любит прозрачность, поэтому у
// apple-touch-icon квадрат без скругления (rx="0" вместо rx="174"). Сам favicon.svg — векторная копия картинки
// владельца 2026-10-30: средняя линия белой полосы снята с растра 1024 px и сглажена кривой Безье.
//
// Запуск из корня: PATH=/usr/local/bin:$PATH node scripts/favicon.mjs. Нужен Chromium Playwright из web/node_modules
// (npm ci в web/); сеть не нужна.
import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'web/public');
const require = createRequire(join(ROOT, 'web/package.json'));
const {chromium} = require('playwright');

const svg = await readFile(join(PUBLIC, 'favicon.svg'), 'utf8');
const square = svg.replaceAll('rx="174"', 'rx="0"');
if (square === svg) {
    console.error('favicon.svg has no rx="174": update the apple-touch-icon replacement in scripts/favicon.mjs');
    process.exit(1);
}

const browser = await chromium.launch();
async function render(source, size) {
    const page = await browser.newPage({viewport: {width: size, height: size}});
    const url = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
    await page.setContent(
        `<body style="margin:0"><img src="${url}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await page.locator('img').evaluate((img) => img.decode());
    const png = await page.screenshot({omitBackground: true});
    await page.close();
    return png;
}

// ICO с картинками PNG внутри (так умеют все браузеры с поддержкой ICO): заголовок 6 байт, по 16 байт на картинку
function ico(images) {
    const header = Buffer.alloc(6 + 16 * images.length);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach(({size, png}, i) => {
        const entry = 6 + 16 * i;
        header.writeUInt8(size, entry);
        header.writeUInt8(size, entry + 1);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(png.length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += png.length;
    });
    return Buffer.concat([header, ...images.map(({png}) => png)]);
}

try {
    const images = [];
    for (const size of [16, 32, 48]) {
        images.push({size, png: await render(svg, size)});
    }
    await writeFile(join(PUBLIC, 'favicon.ico'), ico(images));
    await writeFile(join(PUBLIC, 'apple-touch-icon.png'), await render(square, 180));
    console.log('favicon.ico (16, 32, 48) and apple-touch-icon.png (180) written to web/public');
} finally {
    await browser.close();
}
