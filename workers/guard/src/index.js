// Отвечает функциям Pages, укладывается ли IP клиента в лимит: 204 — да, 429 — нет. IP приходит
// в X-Client-IP от middleware (src/client.js); без него лимит не применяется.
const worker = {
    async fetch(request, env) {
        const ip = request.headers.get('X-Client-IP');
        if (!ip) {
            return new Response(null, {status: 204});
        }
        const {success} = await env.RATE_LIMITER.limit({key: ip});
        return new Response(null, {status: success ? 204 : 429});
    },
};

export default worker;
