// Превью подложек для столбца справа (change layer-thumbnails, design «Превью — картинки в сборке»): один тайл каждой
// подложки каталога над одним и тем же местом, половина тайла вокруг места → 72 px (круг 36 CSS px на экране 2x), WebP.
// Картинки лежат в web/src/layers/thumbnails/<код>.webp и попадают в сборку; приложение тайлов ради превью не
// запрашивает. Подложка без картинки (тайл не скачался, свой слой) показывается кругом с буквами названия.
//
// Запуск из корня: PATH=/usr/local/bin:$PATH node --experimental-strip-types scripts/layer-thumbnails.mjs [код…]
// Без кодов — все подложки каталога. Нужны Chromium Playwright из web/node_modules (npm ci в web/) и сеть.
// Tracestrack Topo — через боевой прокси, только когда у него есть ключ TRACESTRACK_KEY: без ключа прокси отвечает
// 503, и картинка Tt не появится (скрипт так и напишет). Страница — пустая заглушка на origin клона: прокси пускает
// только свои origin, провайдеры видят обычный Referer сайта.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCatalog} from '../web/src/layers/catalog.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'web/src/layers/thumbnails');
const {chromium} = createRequire(join(ROOT, 'web/package.json'))('playwright');

// Местиа (Сванетия), z12: в кадре город, дороги, река и склоны — отличаются и карты, и снимки
const PLACE = {lat: 43.0467, lng: 42.7286, zoom: 12};
const ORIGIN = 'https://nakarte-routing.pages.dev';
const CORS_PROXY_URL = 'https://nakarte-cors-proxy.nakarte-routing.workers.dev/';

function tileOf({lat, lng, zoom}) {
    const n = 2 ** zoom;
    const rad = (lat * Math.PI) / 180;
    const x = ((lng + 180) / 360) * n;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    // fx, fy — место точки внутри тайла (0…1): кадр берётся вокруг неё
    return {x: Math.floor(x), y: Math.floor(y), z: zoom, fx: x % 1, fy: y % 1};
}

function quadkey({x, y, z}) {
    let key = '';
    for (let i = z; i > 0; i--) {
        const mask = 1 << (i - 1);
        key += ((x & mask ? 1 : 0) + (y & mask ? 2 : 0)).toString();
    }
    return key;
}

// токены шаблона MapLibre, которые встречаются у подложек каталога
function tileUrl(template, tile) {
    return template
        .replace('{z}', String(tile.z))
        .replace('{x}', String(tile.x))
        .replace('{y}', String(tile.y))
        .replace('{quadkey}', quadkey(tile))
        .replace('{ratio}', '');
}

const only = new Set(process.argv.slice(2));
const bases = buildCatalog({pixelRatio: 1, language: 'en', corsProxyUrl: CORS_PROXY_URL}).filter(
    (layer) => !layer.isOverlay && (only.size === 0 || only.has(layer.code)),
);
const tile = tileOf(PLACE);

const browser = await chromium.launch();
let failed = 0;
try {
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/__thumbnails`, (route) =>
        route.fulfill({contentType: 'text/html', body: '<!doctype html>'}),
    );
    await page.goto(`${ORIGIN}/__thumbnails`);
    for (const layer of bases) {
        const url = tileUrl(layer.source.tiles[0], tile);
        // ошибка одной подложки (нет CORS, не картинка, сеть) не останавливает остальные
        const result = await page.evaluate(
            async ({src, fx, fy}) => {
                try {
                    const response = await fetch(src, {mode: 'cors'});
                    if (!response.ok) {
                        return {error: `HTTP ${response.status}`};
                    }
                    const bitmap = await createImageBitmap(await response.blob());
                    const canvas = new OffscreenCanvas(72, 72);
                    const context = canvas.getContext('2d');
                    // половина тайла вокруг точки: на круге 36 px целый тайл превратился бы в пятно цвета
                    const size = bitmap.width / 2;
                    const left = Math.min(Math.max(fx * bitmap.width - size / 2, 0), bitmap.width - size);
                    const top = Math.min(Math.max(fy * bitmap.height - size / 2, 0), bitmap.height - size);
                    context.drawImage(bitmap, left, top, size, size, 0, 0, 72, 72);
                    const blob = await canvas.convertToBlob({type: 'image/webp', quality: 0.8});
                    return {bytes: [...new Uint8Array(await blob.arrayBuffer())]};
                } catch (error) {
                    return {error: String(error)};
                }
            },
            {src: url, fx: tile.fx, fy: tile.fy},
        );
        if (result.error) {
            failed++;
            console.error(`${layer.code} ${layer.title}: ${result.error} ${url}`);
            continue;
        }
        await writeFile(join(OUT_DIR, `${layer.code}.webp`), Uint8Array.from(result.bytes));
        console.log(`${layer.code} ${layer.title}: ${result.bytes.length} bytes`);
    }
} finally {
    await browser.close();
}
process.exitCode = failed ? 1 : 0;
