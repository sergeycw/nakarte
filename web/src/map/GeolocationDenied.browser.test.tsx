import { afterEach, beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import '@/index.css';
import { renderApp } from '@/test/render-app';
import { type FixtureTiles, fixtureTiles } from '@/test/tiles';

// Спека web-client, «Геолокация недоступна». Отдельный файл: MapLibre проверяет поддержку геолокации один раз на модуль
// (checkGeolocationSupport кеширует ответ), а у каждого файла browser-тестов свой iframe и свои модули.

let tiles: FixtureTiles;

beforeEach(() => {
    localStorage.clear();
    tiles = fixtureTiles();
    // доступ для сайта запрещён раньше: Permissions API отвечает denied
    Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: { query: async () => ({ state: 'denied' }) },
    });
});

afterEach(async () => {
    await cleanup();
    Reflect.deleteProperty(navigator, 'permissions');
    expect(tiles.external, 'запросы мимо localhost и тайлов').toEqual([]);
});

test('Доступ запрещён раньше', async () => {
    await renderApp(tiles, '#m=10/41/44&l=O');
    const button = page.getByRole('button', { name: 'Location not available' });
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute('title', 'Location not available');
});
