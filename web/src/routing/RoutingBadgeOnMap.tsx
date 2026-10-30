import { useMap } from '@vis.gl/react-maplibre';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/state/context';
import { tracksRouting } from './line';
import { RouteThread } from './RouteThread';

// Бейдж ожидания прокладки у указателя мыши (спека route-editing, «Бейдж ожидания у указателя»; design
// route-thread-loader). Картинку курсора браузеры не анимируют (первый кадр GIF, APNG и SVG), поэтому бейдж — элемент
// над картой, а курсор остаётся своим: перекрестие рисования, move над опорной точкой. Указатель — Pointer Events
// только мыши: после касания браузер шлёт совместимые mousemove, и бейдж остался бы под пальцем. pointerleave холста
// срабатывает и над панелями, маркерами и контролами — они не потомки холста. Положение пишется в стиль мимо React,
// клики проходят сквозь бейдж к карте.

// левый верхний угол бейджа от острия стрелки, px: правее и ниже стрелки, где у курсора progress колёсико
const OFFSET = { x: 12, y: 16 };

const badgeTransform = ({ x, y }: { x: number; y: number }) => `translate(${x + OFFSET.x}px, ${y + OFFSET.y}px)`;

export function RoutingBadgeOnMap() {
    const { current } = useMap();
    const map = current?.getMap();
    const routing = useAppStore((state) => tracksRouting(state.tracks));
    const [over, setOver] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    // острие в координатах контейнера карты: бейдж появляется по ответу роутера, когда мышь уже стоит
    const at = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!map) {
            return;
        }
        const canvas = map.getCanvas();
        const onPointer = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse') {
                setOver(false);
                return;
            }
            const rect = map.getContainer().getBoundingClientRect();
            at.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            ref.current?.style.setProperty('transform', badgeTransform(at.current));
            setOver(true);
        };
        const onLeave = () => setOver(false);
        canvas.addEventListener('pointermove', onPointer);
        canvas.addEventListener('pointerdown', onPointer);
        canvas.addEventListener('pointerleave', onLeave);
        return () => {
            canvas.removeEventListener('pointermove', onPointer);
            canvas.removeEventListener('pointerdown', onPointer);
            canvas.removeEventListener('pointerleave', onLeave);
        };
    }, [map]);

    if (!routing || !over) {
        return null;
    }
    // положение при появлении — из последнего движения, дальше его пишет onPointer
    return (
        <div
            ref={ref}
            className="pointer-events-none absolute top-0 left-0 z-10 size-[18px]"
            style={{ transform: badgeTransform(at.current) }}
            data-testid="routing-badge"
        >
            <RouteThread variant="badge" />
        </div>
    );
}
