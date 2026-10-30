// Группы слоёв столбца справа. Три круга подложек — по одному на тип (владелец 2026-10-28, design three-quick-bases) и
// кнопка тепловой карты Strava; у каждого своя группа слоёв для меню под значком (владелец 2026-10-29, design
// quick-layer-menus). Без импортов: группы читает и столбец (QuickLayers.tsx), и скрипт превью
// scripts/layer-thumbnails.mjs, которому .tsx не импортировать. Google Map — без лицензии (backlog, «Лицензии слоёв и
// поиска»): если тайлы пропадут, заменить первый код группы здесь, задать место в PLACES скрипта и переснять картинку
// превью

export interface QuickLayerGroup {
    // имя значка меню и самого меню (aria-label); не совпадает с секциями All layers (там есть оверлеи «Topo maps»)
    name: string;
    // первый код — сам круг (у подложек — и картинка превью), порядок — порядок пунктов меню
    codes: readonly string[];
}

// Состав групп подложек — таблица владельца (design quick-layer-menus). Hls и свои слои ни в одну группу не входят; что
// каждая подложка каталога, кроме слоя с dated, в какой-то группе есть, сверяет quick-layers.test.ts. Круг топокарты —
// OpenFreeMap Outdoor, подложка по умолчанию (design openfreemap-default-basemap): с Tracestrack первым круг показывал бы
// его картинку при включённой Of и после смены группы возвращал бы на Tracestrack, тратя его квоту
export const QUICK_BASE_GROUPS: readonly QuickLayerGroup[] = [
    { name: 'Topo layers', codes: ['Of', 'Tt', 'Otm', 'Oso', 'Ocm', 'Co'] },
    { name: 'Map layers', codes: ['G', 'O', 'P'] },
    { name: 'Satellite layers', codes: ['E', 'L', 'I', 'S2'] },
];

// Оверлеи с кнопкой в столбце: из группы на карте один слой (выбор в меню выключает остальные), кнопка включает и
// выключает его. Отмывки в столбце нет (владелец 2026-10-29): она — в All layers
export const QUICK_OVERLAY_GROUPS: readonly QuickLayerGroup[] = [
    { name: 'Strava heatmaps', codes: ['Sa', 'Sr', 'Sb', 'Sw'] },
];

export const QUICK_BASES = QUICK_BASE_GROUPS.map((group) => group.codes[0]);

// Первый слой группы — сама кнопка столбца: он в меню и в столбце всегда, галочка Configure layers на него не влияет
export function isColumnButton(code: string): boolean {
    return quickGroupOf(code)?.codes[0] === code;
}

export function quickGroupOf(code: string): QuickLayerGroup | undefined {
    return [...QUICK_BASE_GROUPS, ...QUICK_OVERLAY_GROUPS].find((group) => group.codes.includes(code));
}

// Память столбца: первый код группы → слой группы, выбранный последним. Тот же объект, если запоминать нечего: стор по
// ссылке на настройки решает, писать ли их в localStorage
export function rememberQuickLayer(memory: Readonly<Record<string, string>>, code: string) {
    const group = quickGroupOf(code);
    if (!group || memory[group.codes[0]] === code) {
        return memory;
    }
    return { ...memory, [group.codes[0]]: code };
}

// Слой, который включит нажатие на круг. current — слой группы, который сейчас на карте: отмеченный круг остаётся на
// нём, иначе после ссылки или старых настроек без памяти он переключал бы на другой слой того же типа. Запомненный,
// которого нет в меню (скрыт в Configure layers, пропал из каталога), уступает первому слою группы
export function quickTarget(
    group: QuickLayerGroup,
    memory: Readonly<Record<string, string>>,
    current: string | undefined,
    menu: readonly string[],
): string {
    if (current !== undefined) {
        return current;
    }
    const remembered = memory[group.codes[0]];
    return remembered && menu.includes(remembered) ? remembered : group.codes[0];
}
