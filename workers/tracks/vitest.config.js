import {cloudflareTest} from '@cloudflare/vitest-pool-workers';
import {defineConfig} from 'vitest/config';

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: {configPath: './wrangler.toml'},
            // лимиты частоты понижены (все запросы — 3, записи — 2), чтобы `429` проверялся несколькими запросами;
            // `namespace_id` — имя поля miniflare, camelCase тут не выбрать
            miniflare: {
                ratelimits: {
                    RATE_LIMITER: {namespace_id: '1003', simple: {limit: 3, period: 60}},
                    WRITE_RATE_LIMITER: {namespace_id: '1006', simple: {limit: 2, period: 60}},
                },
            },
        }),
    ],
});
