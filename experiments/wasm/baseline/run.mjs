import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const {routes, profiles} = JSON.parse(readFileSync(join(here, '../routes.json'), 'utf8'));
const server = process.env.BROUTER_URL ?? 'http://localhost:17777';
const runs = Number(process.env.RUNS ?? 5);

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

const rows = [];
for (const route of routes) {
    for (const profile of profiles) {
        const url = new URL('/brouter', server);
        const lonlats = [route.from, route.to].map(([lat, lng]) => `${lng},${lat}`).join('|');
        url.searchParams.set('lonlats', lonlats);
        url.searchParams.set('profile', profile);
        url.searchParams.set('alternativeidx', '0');
        url.searchParams.set('format', 'geojson');

        const times = [];
        let body;
        for (let i = 0; i < runs; i++) {
            const start = performance.now();
            const response = await fetch(url);
            body = await response.text();
            times.push(performance.now() - start);
            if (!response.ok) {
                throw new Error(`${route.id}/${profile}: ${response.status} ${body}`);
            }
        }
        const geojson = JSON.parse(body);
        const feature = geojson.features[0];
        writeFileSync(join(here, `${route.id}_${profile}.geojson`), JSON.stringify(geojson, null, 1));
        rows.push({
            route: route.id,
            profile,
            lengthM: Number(feature.properties['track-length']),
            points: feature.geometry.coordinates.length,
            ascendM: Number(feature.properties['filtered ascend']),
            firstMs: Math.round(times[0]),
            medianMs: Math.round(median(times)),
        });
    }
}

writeFileSync(join(here, 'summary.json'), JSON.stringify({server, runs, rows}, null, 2) + '\n');
console.log('| route | profile | length, m | points | ascend, m | first, ms | median, ms |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
    console.log(
        `| ${r.route} | ${r.profile} | ${r.lengthM} | ${r.points} | ${r.ascendM} | ${r.firstMs} | ${r.medianMs} |`
    );
}
