/* eslint camelcase: ["error", {"allow": ["namespace_id"]}] */
import {cloudflareTest} from '@cloudflare/vitest-pool-workers';
import {defineConfig} from 'vitest/config';

export default defineConfig({
    plugins: [
        cloudflareTest({
            wrangler: {configPath: './wrangler.toml'},
            // лимит частоты понижен, чтобы `429` проверялся несколькими запросами;
            // `namespace_id` — имя поля miniflare, camelCase тут не выбрать
            miniflare: {ratelimits: {RATE_LIMITER: {namespace_id: '1003', simple: {limit: 3, period: 60}}}},
        }),
    ],
});
