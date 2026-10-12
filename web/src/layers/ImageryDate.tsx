import { cn } from 'cn';
import { CalendarIcon, CheckIcon, CloudIcon, LoaderCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore, useAppStoreApi } from '@/state/context';
import {
    ageDays,
    type ImageryDate as DateItem,
    defaultDate,
    FIRST_DATE,
    fetchDates,
    HLS_LATENCY_DAYS,
    isDate,
    isoDay,
    type Point,
} from './dated';

// Кнопка даты снимков по датам снизу по центру, рядом с кнопкой профиля (design add-dated-imagery, «Кнопка даты снизу
// по центру»): видна, пока подложка — слой с dated. Без даты в сторе сама берёт дату по умолчанию из Earth Search над
// центром карты; список дат — по нажатию, заново, если карта ушла от точки прошлого запроса.

// ≈ 10 км: дальше — другой квадрат MGRS, у него свои даты и облачность
const RELOAD_DEGREES = 0.1;

type Dates = { center: Point } & ({ status: 'loading' } | { status: 'error' } | { status: 'done'; dates: DateItem[] });

const PILL =
    'glass pointer-events-auto flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 font-medium text-sm tabular-nums transition-colors hover:bg-white/90 [&_svg]:size-4 [&_svg]:shrink-0';

function cloudText(cloudCover: number | null): string | null {
    return cloudCover === null ? null : `${Math.round(cloudCover)}%`;
}

function DateButton({ fetch }: { fetch: typeof window.fetch }) {
    const store = useAppStoreApi();
    const date = useAppStore((state) => state.imageryDate);
    const setDate = useAppStore((state) => state.setImageryDate);
    const [dates, setDates] = useState<Dates | null>(null);
    const [open, setOpen] = useState(false);
    const abort = useRef<AbortController | null>(null);
    const otherId = useId();

    const load = useCallback(() => {
        const { lat, lng } = store.getState().view;
        const center = { lat, lng };
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setDates({ center, status: 'loading' });
        const today = new Date();
        fetchDates(fetch, center, today, controller.signal).then(
            (found) => {
                if (controller.signal.aborted) {
                    return;
                }
                // пустой ответ (открытый океан, полярная ночь) — тоже «недоступно»: выбрать в списке нечего, остаётся Other date
                setDates(found.length ? { center, status: 'done', dates: found } : { center, status: 'error' });
                // дата по умолчанию — только если её так и нет: пользователь мог выбрать свою, пока шёл запрос
                const fallback = defaultDate(found, today);
                if (store.getState().imageryDate === null && fallback) {
                    store.getState().setImageryDate(fallback);
                }
            },
            () => {
                if (!controller.signal.aborted) {
                    setDates({ center, status: 'error' });
                }
            },
        );
    }, [fetch, store]);

    // без даты — запрос дат для даты по умолчанию; после ошибки повтор — только кнопкой Retry
    useEffect(() => {
        if (date === null && dates === null) {
            load();
        }
    }, [date, dates, load]);

    useEffect(() => () => abort.current?.abort(), []);

    function onOpenChange(next: boolean) {
        setOpen(next);
        if (!next) {
            return;
        }
        const { lat, lng } = store.getState().view;
        const moved =
            !dates ||
            Math.abs(dates.center.lat - lat) > RELOAD_DEGREES ||
            Math.abs(dates.center.lng - lng) > RELOAD_DEGREES;
        if (moved || dates.status === 'error') {
            load();
        }
    }

    function choose(next: string) {
        setDate(next);
        setOpen(false);
    }

    const today = new Date();
    const current = dates?.status === 'done' ? dates.dates.find((item) => item.date === date) : undefined;
    const cloud = current ? cloudText(current.cloudCover) : null;
    let label: string;
    if (date) {
        label = date;
    } else if (dates?.status === 'error') {
        label = 'Dates unavailable';
    } else {
        label = 'Loading dates';
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger
                render={<button type="button" className={PILL} title="Imagery date" data-testid="imagery-date" />}
            >
                {!date && dates?.status !== 'error' ? (
                    <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                ) : (
                    <CalendarIcon aria-hidden="true" />
                )}
                <span className="sr-only">Imagery date</span>
                {label}
                {cloud && (
                    <span className="flex items-center gap-1 font-normal text-muted-foreground">
                        <CloudIcon aria-hidden="true" />
                        {cloud}
                    </span>
                )}
            </PopoverTrigger>
            {/* вверх: кнопка снизу, над ней карта */}
            <PopoverContent
                side="top"
                className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-1.5rem)] gap-1 overflow-y-auto overscroll-contain p-1.5"
                data-testid="imagery-dates"
            >
                <div className="px-1.5 pt-0.5 font-medium text-muted-foreground text-xs">
                    Satellite passes near the map center, last 90 days
                </div>
                {dates?.status === 'loading' && (
                    <div className="flex items-center gap-2 px-1.5 py-1 text-muted-foreground">
                        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
                        Loading dates…
                    </div>
                )}
                {dates?.status === 'error' && (
                    <div className="flex items-center gap-2 px-1.5 py-1">
                        <span className="text-muted-foreground">Dates unavailable</span>
                        <Button variant="outline" size="xs" onClick={load}>
                            Retry
                        </Button>
                    </div>
                )}
                {dates?.status === 'done' && (
                    <ul className="flex flex-col" aria-label="Imagery dates">
                        {dates.dates.map((item) => {
                            const selected = item.date === date;
                            const fresh = ageDays(item.date, today) < HLS_LATENCY_DAYS;
                            return (
                                <li key={item.date}>
                                    <button
                                        type="button"
                                        aria-current={selected ? 'date' : undefined}
                                        data-date={item.date}
                                        onClick={() => choose(item.date)}
                                        className={cn(
                                            'flex min-h-7 w-full cursor-pointer items-center gap-3 rounded-md px-1.5 text-left tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50',
                                            selected && 'font-medium',
                                        )}
                                    >
                                        <CheckIcon
                                            className={cn('size-3.5 shrink-0', !selected && 'invisible')}
                                            aria-hidden="true"
                                        />
                                        <span>{item.date}</span>
                                        <span className="flex w-14 items-center gap-1 text-muted-foreground">
                                            <CloudIcon className="size-3.5 shrink-0" aria-hidden="true" />
                                            {cloudText(item.cloudCover) ?? '—'}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {item.satellites.join(', ')}
                                            {fresh && ' · may not be ready'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <label
                    htmlFor={otherId}
                    className="flex items-center gap-2 border-border border-t px-1.5 pt-1.5 text-muted-foreground text-xs"
                >
                    Other date
                    {/* key: после выбора из списка поле показывает новую дату, а не введённую раньше */}
                    <Input
                        key={date}
                        id={otherId}
                        type="date"
                        min={FIRST_DATE}
                        max={isoDay(today)}
                        defaultValue={date ?? ''}
                        className="h-7 w-auto"
                        onChange={(event) => {
                            const { value } = event.target;
                            if (isDate(value) && value >= FIRST_DATE && value <= isoDay(today)) {
                                choose(value);
                            }
                        }}
                    />
                </label>
            </PopoverContent>
        </Popover>
    );
}

export function ImageryDateButton({ fetch }: { fetch: typeof window.fetch }) {
    const dated = useAppStore((state) => state.layers.get(state.selection.base)?.dated === true);
    return dated ? <DateButton fetch={fetch} /> : null;
}
