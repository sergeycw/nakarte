// Скрывает провайдеров панорам клона по имени (`excludedPanoramaProviders` из config-target),
// чтобы не править src/lib/leaflet.control.panoramas апстрима. Контрол строит провайдеров в
// initialize() через getProviders() и дальше (список, покрытие, адрес `n2=`) работает только с
// this.providers, поэтому подмены getProviders в наследнике достаточно. Код скрытого провайдера в
// адресе unserializeState ищет среди this.providers и просто не находит.
function excludePanoramaProviders(PanoramasControl, excludedNames) {
    if (!excludedNames?.length) {
        return PanoramasControl;
    }
    const excluded = new Set(excludedNames);
    return PanoramasControl.extend({
        getProviders: function () {
            return PanoramasControl.prototype.getProviders
                .call(this)
                .filter((provider) => !excluded.has(provider.name));
        },
    });
}

export {excludePanoramaProviders};
