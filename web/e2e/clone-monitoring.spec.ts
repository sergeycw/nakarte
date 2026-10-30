import { readdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { ELEVATION_SERVER, expect, openTracks, test } from './fixtures.ts';

// Трекер ошибок на сборке клона (спека clone-monitoring, design add-error-tracking): приём Sentry подменён заглушкой
// фикстуры network, конверты лежат в network.sentryEnvelopes. Сценарии идут, только если в сборке есть DSN: в CI —
// поддельный из check-web.yml или настоящий секрет деплоя; локальная `npm run build` без DSN их пропускает.

const ASSETS = new URL('../../build/assets/', import.meta.url);
const DSN_IN_BUNDLE = /https:\/\/\w+@o\d+\.ingest\.(?:[a-z]+\.)?sentry\.io\/\d+/;
const buildHasDsn = readdirSync(ASSETS)
    .filter((file) => file.endsWith('.js'))
    .some((file) => DSN_IN_BUNDLE.test(readFileSync(new URL(file, ASSETS), 'utf8')));

// saveNktk({name: 'Mtatsminda', …}) — тот же трек, что в elevation-profile.spec.ts
const TBILISI = 'RAoCEAESNgoKTXRhdHNtaW5kYRIQCgbele0B0gMSBorn_gHzAhoWCICZ7QEQluT-ARoKGghUViB0b3dlcg==';
const LINK = `./#m=15/41.692/44.788&nktk=${TBILISI}`;

// событие из конверта: строка заголовка конверта, строка заголовка элемента, тело; берётся элемент type: event
function eventOf(envelope: string) {
    const lines = envelope.split('\n');
    const index = lines.findIndex((line) => line.includes('"type":"event"'));
    return JSON.parse(lines[index + 1]);
}

async function openProfile(page: Page) {
    await openTracks(page);
    await page.getByRole('button', { name: 'Actions for Mtatsminda' }).click();
    await page.getByRole('menuitem', { name: 'Show elevation profile', exact: true }).click();
    await expect(page.getByTestId('elevation-profile').locator('[data-stat="distance"]')).toHaveText(/km$/);
}

test.describe('Ошибки в браузере пользователей', () => {
    test.skip(!buildHasDsn, 'сборка без VITE_SENTRY_DSN: трекер выключен');

    test('Ошибка на ссылке с треком', async ({ page, network }) => {
        await page.goto(LINK);
        await openProfile(page);
        expect(network.elevationRequests).toHaveLength(1);
        // встроенный скрипт: его кадр стека несёт адрес страницы целиком, вместе с #m=… и треком
        await page.addScriptTag({
            content: "setTimeout(() => { throw new Error('e2e crash at ' + location.href); }, 0);",
        });
        await expect.poll(() => network.sentryEnvelopes.length).toBe(1);
        const event = eventOf(network.takeSentryEnvelopes()[0]);
        const origin = new URL(page.url()).origin;
        expect(event.request.url).toBe(`${origin}/`);
        expect(event.exception.values[0].value).toBe(`e2e crash at ${origin}`);
        const text = JSON.stringify(event);
        // Mtatsminda — название трека: кнопка «Actions for Mtatsminda» попадает в крошку клика
        const leaks = [
            '41.692',
            '44.788',
            'm=15',
            'Mtatsminda',
            TBILISI.slice(0, 20),
            new URL(ELEVATION_SERVER).hostname,
        ];
        expect(event.breadcrumbs?.length, 'клики по меню трека есть в крошках').toBeGreaterThan(0);
        for (const leak of leaks) {
            expect(text, leak).not.toContain(leak);
        }
        for (const breadcrumb of event.breadcrumbs ?? []) {
            expect(['ui.click', 'ui.input']).toContain(breadcrumb.category);
        }
        expect(event.user?.ip_address).toBeUndefined();
    });

    // остальные e2e проверяют то же в конце каждого теста (фикстура network); здесь — со скрытием вкладки: при нём SDK
    // отправил бы отчёт клиента и сессию, если бы они были включены. Ошибку ResizeObserver SDK отбрасывает по умолчанию
    // (DEFAULT_IGNORE_ERRORS), но включённый отчёт клиента сообщил бы о ней при скрытии
    test('Заход без ошибок', async ({ page, network }) => {
        await page.goto(LINK);
        await openProfile(page);
        await page.addScriptTag({
            content:
                "setTimeout(() => { throw new Error('ResizeObserver loop completed with undelivered notifications.'); }, 0);",
        });
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForTimeout(1500);
        expect(network.sentryEnvelopes).toEqual([]);
    });
});
