import { LoaderCircleIcon, SearchIcon, XIcon } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStoreApi } from '@/state/context';
import { isCoordinatesQuery } from './coordinates';
import { isLinkQuery } from './links';
import type { SearchResult } from './result';
import { type Attribution, MIN_QUERY_LENGTH, type SearchSources, search } from './search';

// Строка поиска в панели с названием (design add-web-search-panoramas, «Где живёт строка поиска»): результаты — списком
// под строкой, пока фокус внутри; клавиши — SearchViewModel.onKeyDown старого клиента. Поисковики — с паузой ввода,
// координаты и ссылки — сразу. Ответ на устаревший запрос отбрасывается (номер запроса), прежний запрос отменяется.

const TYPING_DELAY_MS = 400;

type Shown =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'results'; results: SearchResult[]; attribution: Attribution | null }
    | { kind: 'error'; message: string };

export function SearchBox({ sources }: { sources: SearchSources }) {
    const store = useAppStoreApi();
    const [query, setQuery] = useState('');
    const [shown, setShown] = useState<Shown>({ kind: 'idle' });
    const [active, setActive] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const request = useRef<{ seq: number; abort: AbortController | null; timer?: ReturnType<typeof setTimeout> }>({
        seq: 0,
        abort: null,
    });
    const listId = useId();

    function cancel() {
        const current = request.current;
        clearTimeout(current.timer);
        current.abort?.abort();
        current.abort = null;
        current.seq += 1;
    }

    function start(text: string) {
        cancel();
        const trimmed = text.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setShown({ kind: 'idle' });
            return;
        }
        const seq = request.current.seq;
        const run = async () => {
            const abort = new AbortController();
            request.current.abort = abort;
            const { view } = store.getState();
            setShown({ kind: 'loading' });
            try {
                const outcome = await search(
                    trimmed,
                    {
                        lat: view.lat,
                        lng: view.lng,
                        zoom: view.zoom,
                        languages: navigator.languages,
                        signal: abort.signal,
                    },
                    sources,
                );
                if (seq === request.current.seq) {
                    setHighlighted(0);
                    setShown(outcome);
                }
            } catch {
                // отменён новым запросом
            }
        };
        const immediate = isLinkQuery(trimmed) || isCoordinatesQuery(trimmed);
        if (immediate) {
            void run();
        } else {
            request.current.timer = setTimeout(run, TYPING_DELAY_MS);
        }
    }

    // Alt+L — фокус в строку поиска (hotkey старого); code, а не key: на macOS Alt меняет символ
    // biome-ignore lint/correctness/useExhaustiveDependencies: cancel читает только ref
    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.altKey && event.code === 'KeyL') {
                event.preventDefault();
                input.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            cancel();
        };
    }, []);

    function choose(result: SearchResult) {
        const state = store.getState();
        if (result.bounds) {
            state.requestBounds(result.bounds);
        } else {
            state.requestView({ ...result.latlng, zoom: result.zoom ?? state.view.zoom });
        }
        state.setPlacemark({ ...result.latlng, title: result.title });
        leave();
    }

    // фокус — карте (escapePressed → setFocusToMap старого)
    function leave() {
        setActive(false);
        input.current?.blur();
        document.querySelector<HTMLElement>('.maplibregl-canvas')?.focus();
    }

    const results = shown.kind === 'results' ? shown.results : [];
    const tooShort = query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH;
    const open = active && (results.length > 0 || shown.kind === 'error' || shown.kind === 'loading' || tooShort);

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
            setShown({ kind: 'idle' });
            leave();
            return;
        }
        if (!results.length) {
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlighted((highlighted + 1) % results.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlighted((highlighted - 1 + results.length) % results.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(results[Math.min(highlighted, results.length - 1)]);
        }
    }

    return (
        // focus и blur всплывают от строки и вариантов: так видно, что фокус ушёл из поиска целиком
        // biome-ignore lint/a11y/noStaticElementInteractions: обёртка ловит фокус потомков, сама не интерактивна
        <div
            className="flex flex-col gap-1.5"
            data-testid="search"
            onFocus={() => {
                if (!active) {
                    setActive(true);
                    // фокус вернулся, а результатов нет — искать снова (onInputHasFocusChange старого)
                    if (shown.kind === 'idle') {
                        start(query);
                    }
                }
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setActive(false);
                }
            }}
        >
            <div className="relative">
                <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 text-muted-foreground" />
                <Input
                    ref={input}
                    className="pr-7 pl-7"
                    placeholder="Search places, coordinates, links"
                    title="Search places, coordinates, links (Alt+L)"
                    aria-label="Search"
                    role="combobox"
                    aria-expanded={open && results.length > 0}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        start(event.target.value);
                    }}
                    onKeyDown={onKeyDown}
                />
                {query && (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="-translate-y-1/2 absolute top-1/2 right-1"
                        aria-label="Clear search"
                        onClick={() => {
                            setQuery('');
                            start('');
                            input.current?.focus();
                        }}
                    >
                        <XIcon />
                    </Button>
                )}
            </div>
            {open && (
                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
                    {tooShort && <p className="text-muted-foreground">Type at least {MIN_QUERY_LENGTH} characters</p>}
                    {!tooShort && shown.kind === 'loading' && (
                        <LoaderCircleIcon
                            className="size-4 animate-spin text-muted-foreground"
                            aria-label="Searching"
                        />
                    )}
                    {!tooShort && shown.kind === 'error' && <p data-testid="search-error">{shown.message}</p>}
                    {!tooShort && results.length > 0 && (
                        <div id={listId} role="listbox" aria-label="Search results" className="flex flex-col">
                            {results.map((result, index) => (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: у двух результатов может быть одно название
                                    key={`${result.title}-${index}`}
                                    role="option"
                                    // фокус не уходит из строки (aria-activedescendant-образный выбор стрелками)
                                    tabIndex={-1}
                                    aria-selected={index === highlighted}
                                    // фокус остаётся в строке: иначе Safari, который не фокусирует кнопки по клику, закрыл
                                    // бы список раньше клика
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseMove={() => setHighlighted(index)}
                                    onClick={() => choose(result)}
                                    onKeyDown={() => {}}
                                    className={`cursor-pointer rounded-md px-2 py-1 ${index === highlighted ? 'bg-muted' : ''}`}
                                >
                                    <div className="truncate font-medium">{result.title}</div>
                                    {result.subtitle && (
                                        <div className="truncate text-muted-foreground text-xs">{result.subtitle}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {!tooShort && shown.kind === 'results' && shown.attribution && (
                        <a
                            className="self-end text-muted-foreground text-xs underline"
                            href={shown.attribution.url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {shown.attribution.text}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
