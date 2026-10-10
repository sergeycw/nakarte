// Круглая стеклянная кнопка-иконка над картой (раскладка трёх зон, design layout-three-zones): 36 px, как кнопки
// MapLibre в столбце справа. Для Button с variant="ghost" и size="icon-lg": glass перебивает фон ghost, подпись —
// только title и aria-label (по нему ищут тесты)
export const ROUND_BUTTON = 'glass pointer-events-auto rounded-full hover:bg-white/90';
