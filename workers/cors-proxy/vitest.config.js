/* eslint camelcase: ["error", {"allow": ["namespace_id"]}] */
import {cloudflareTest} from '@cloudflare/vitest-pool-workers';
import {defineConfig} from 'vitest/config';

// Апстрим прокси подменяет `outboundService`: тест не ходит в сеть. Заглушка отвечает эхом
// запроса (адрес, метод, заголовки) и отдаёт заголовки, которые прокси обязан вырезать или переписать.
function upstream(request) {
    const url = new URL(request.url);
    if (url.pathname === '/redirect') {
        return new Response(null, {status: 302, headers: {Location: '/moved?page=2'}});
    }
    return Response.json(
        {url: request.url, method: request.method, headers: Object.fromEntries(request.headers)},
        {headers: {'Set-Cookie': 'session=1', 'X-Upstream': 'yes'}}
    );
}

const STRAVA_COOKIES = 'CloudFront-Key-Pair-Id=k; CloudFront-Policy=p; CloudFront-Signature=s';

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: {configPath: './wrangler.toml'},
            // лимит частоты понижен, чтобы `429` проверялся несколькими запросами;
            // `namespace_id` — имя поля miniflare, camelCase тут не выбрать
            miniflare: {
                outboundService: upstream,
                // секрет wrangler secret put STRAVA_COOKIES; тут — заглушка
                bindings: {STRAVA_COOKIES: STRAVA_COOKIES},
                ratelimits: {RATE_LIMITER: {namespace_id: '1004', simple: {limit: 3, period: 60}}},
            },
        }),
    ],
});
