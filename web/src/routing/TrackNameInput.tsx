import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useTrackActions } from '@/tracks/actions-context';
import type { Track } from '@/tracks/model';

type Latest = { draft: string | null; track: Track; actions: ReturnType<typeof useTrackActions> };

function commit(latest: RefObject<Latest>) {
    const { draft, track, actions } = latest.current;
    latest.current.draft = null;
    if (draft !== null && draft !== track.name) {
        actions.rename(track, draft);
    }
}

// Название трека в строке редактора (design editor-name-share): поле, которое выглядит как текст. Пока поле в фокусе,
// название — черновик; Enter и уход фокуса зовут rename (пустое не меняет трек), Escape возвращает прежнее. Клавиши
// редактора в поле не работают (фильтр INPUT в MapEditor.tsx), поэтому Escape здесь не заканчивает редактирование.
export function TrackNameInput({ track }: { track: Track }) {
    const actions = useTrackActions();
    const [draft, setDraft] = useState<string | null>(null);
    // черновик и трек в ref: их читает и blur (он идёт синхронно, до нового рендера), и размонтирование
    const latest = useRef<Latest>({ draft, track, actions });
    latest.current = { draft, track, actions };

    // панель исчезла, пока поле в фокусе: iOS Safari не переводит фокус на нажатую кнопку Finish editing, а при удалении поля
    // blur не шлёт — черновик сохраняется здесь
    useEffect(() => () => commit(latest), []);

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        // Enter и Escape, которыми IME подтверждает или отменяет набор, — ещё не конец правки; Safari шлёт keydown после
        // compositionend, там узнать набор можно только по keyCode 229
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
            return;
        }
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        } else if (event.key === 'Escape') {
            latest.current.draft = null;
            event.currentTarget.blur();
        }
    }

    return (
        <Input
            aria-label="Track name"
            title={track.name}
            value={draft ?? track.name}
            className="min-w-0 flex-1 truncate border-transparent px-1 font-medium hover:border-input"
            onFocus={(event) => {
                setDraft(track.name);
                // чаще название заменяют целиком («Track 1» → своё)
                event.currentTarget.select();
            }}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                commit(latest);
                setDraft(null);
            }}
            onKeyDown={onKeyDown}
        />
    );
}
