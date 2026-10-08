// Middleware функций Pages (functions/*/_middleware.js): спрашивает nakarte-guard по service binding GUARD,
// укладывается ли IP клиента в лимит. Вызов по service binding не тарифицируется как запрос.
// Без CF-Connecting-IP, без привязки (локальный wrangler pages dev, тесты) и при сбое счётчика запрос
// проходит: отказ счётчика не должен ломать прокладку маршрута.

// Длина окна [[ratelimits]] в workers/guard/wrangler.toml.
const RETRY_AFTER_SECONDS = '60';
// Адрес для service binding ни на что не влияет: запрос уходит прямо в Worker.
const GUARD_URL = 'https://guard/';

async function allowed(request, env) {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip || !env.GUARD) {
        return true;
    }
    try {
        const answer = await env.GUARD.fetch(GUARD_URL, {headers: {'X-Client-IP': ip}});
        return answer.status !== 429;
    } catch {
        return true;
    }
}

export async function rateLimited(context) {
    if (await allowed(context.request, context.env)) {
        return context.next();
    }
    return new Response('Too many requests\n', {status: 429, headers: {'Retry-After': RETRY_AFTER_SECONDS}});
}
