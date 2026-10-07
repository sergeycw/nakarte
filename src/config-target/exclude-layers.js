// Скрывает слои клона по коду (`excludedLayerCodes` из config-target) на выходе getLayers(),
// чтобы не править src/layers.js апстрима. Всё остальное (хоткеи, печать, адрес `l=`) берёт слои
// из контрола, поэтому фильтра на входе enableLayersConfig достаточно. Неизвестный код в адресе
// или в leafletLayersSettings контрол игнорирует сам.
function excludeLayers(layersConfig, excludedCodes) {
    if (!excludedCodes?.length) {
        return layersConfig;
    }
    const excluded = new Set(excludedCodes);
    const groups = layersConfig.layers
        .map((group) => ({
            ...group,
            layers: group.layers.filter((layer) => !excluded.has(layer.layer.options.code)),
        }))
        // группа, где все слои скрыты, в настройках слоёв не нужна
        .filter((group) => group.layers.length > 0);
    return {...layersConfig, layers: groups};
}

export {excludeLayers};
