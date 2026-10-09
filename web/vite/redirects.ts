// Разбор public/_redirects по правилам Cloudflare Pages в той части, что нужна файлу: точный путь или путь со звёздочкой
// на конце, `:splat` в назначении, первое подходящее правило выигрывает, код по умолчанию 302
// (developers.cloudflare.com/pages/configuration/redirects). Им пользуются unit-тест правил и e2e, который отвечает
// браузеру за Pages: vite preview файл _redirects не читает. Query string сюда не передаётся: Pages переносят его в
// назначение сами (проверено wrangler pages dev), тестам он не нужен.

export interface RedirectRule {
    source: string;
    destination: string;
    status: number;
}

export function parseRedirects(text: string): RedirectRule[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const [source, destination, status] = line.split(/\s+/);
            return { source, destination, status: status ? Number(status) : 302 };
        });
}

export function resolveRedirect(
    rules: readonly RedirectRule[],
    pathname: string,
): { location: string; status: number } | null {
    for (const { source, destination, status } of rules) {
        if (source.endsWith('*')) {
            const prefix = source.slice(0, -1);
            if (pathname.startsWith(prefix)) {
                return { location: destination.replace(':splat', pathname.slice(prefix.length)), status };
            }
        } else if (pathname === source) {
            return { location: destination, status };
        }
    }
    return null;
}
