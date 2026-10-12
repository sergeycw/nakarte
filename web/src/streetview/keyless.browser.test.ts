import { afterEach, describe, expect, test } from 'vitest';
import './keyless.css';

// Правила режима без ключа на разметке, повторяющей окно панорамы Google (Maps JavaScript API 65, проверено на проде
// 2026-10-12): контейнер окна → .gm-style → корень сцены div[aria-label="Street View"] → холст. Холсту Google
// ставит инлайновый filter: invert(1), но не всегда (design fix-street-view-negative).

function panorama({ keyless, googleInvert }: { keyless: boolean; googleInvert: boolean }) {
    const container = document.createElement('div');
    container.classList.toggle('google-street-view-keyless', keyless);
    container.innerHTML = `
        <div class="gm-style">
            <div aria-label="Street View" class="mapsImagerySceneScene__root">
                <canvas class="mapsImagerySceneScene__canvas"${googleInvert ? ' style="filter: invert(1);"' : ''}></canvas>
            </div>
        </div>`;
    document.body.append(container);
    const filterOf = (selector: string) => getComputedStyle(container.querySelector(selector) as Element).filter;
    return { root: () => filterOf('[aria-label="Street View"]'), canvas: () => filterOf('canvas') };
}

afterEach(() => {
    document.body.replaceChildren();
});

describe('Ключ Google в новом приложении', () => {
    test('Сборка без ключа: инверсия Google снята, корень сцены не инвертирован', () => {
        const scene = panorama({ keyless: true, googleInvert: true });
        expect(scene.canvas()).toBe('none');
        expect(scene.root()).toBe('none');
    });

    test('Google не инвертировал панораму', () => {
        const scene = panorama({ keyless: true, googleInvert: false });
        expect(scene.canvas()).toBe('none');
        expect(scene.root()).toBe('none');
    });

    test('Сборка с ключом: правила режима без ключа не применяются', () => {
        const scene = panorama({ keyless: false, googleInvert: true });
        expect(scene.canvas()).toBe('invert(1)');
        expect(scene.root()).toBe('none');
    });
});
