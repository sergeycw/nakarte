import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useTrackActions } from '@/tracks/actions-context';
import type { Track } from '@/tracks/model';

// Название трека в строке редактора (design editor-name-share): поле, которое выглядит как текст. Пока поле в фокусе,
// название — черновик; Enter и уход фокуса зовут rename (пустое не меняет трек), Escape возвращает прежнее. Клавиши
// редактора в поле не работают (фильтр INPUT в MapEditor.tsx), поэтому Escape здесь не заканчивает редактирование.
export function TrackNameInput({ track }: { track: Track }) {
    const actions = useTrackActions();
    const [draft, setDraft] = useState<string | null>(null);
    // Escape уводит фокус, а blur иначе сохранил бы черновик: blur идёт синхронно, до нового рендера
    const cancelled = useRef(false);
    return (
        <Input
            aria-label="Track name"
            title={track.name}
            value={draft ?? track.name}
            className="h-8 min-w-0 flex-1 truncate border-transparent px-1 font-medium hover:border-input"
            onFocus={() => setDraft(track.name)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (!cancelled.current && draft !== null && draft !== track.name) {
                    actions.rename(track, draft);
                }
                cancelled.current = false;
                setDraft(null);
            }}
            onKeyDown={(event) => {
                // Enter, которым IME подтверждает набор, — ещё не конец правки
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                    cancelled.current = true;
                    event.currentTarget.blur();
                }
            }}
        />
    );
}
