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

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: {configPath: './wrangler.toml'},
            miniflare: {outboundService: upstream},
        }),
    ],
});
