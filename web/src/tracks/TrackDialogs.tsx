import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/state/context';
import { useTrackActions } from './actions-context';
import type { Track } from './model';

export function RenameTrackDialog({ track, onClose }: { track: Track; onClose: () => void }) {
    const actions = useTrackActions();
    const [name, setName] = useState(track.name);

    function submit() {
        actions.rename(track, name);
        onClose();
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename track</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <Input aria-label="Track name" value={name} onChange={(event) => setName(event.target.value)} />
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={submit}>Ok</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Ссылка, которую не удалось положить в буфер обмена (design add-web-tracks, «Ссылка — после ответа хранилища»)
export function SharedLinkDialog() {
    const link = useAppStore((state) => state.sharedLink);
    const setSharedLink = useAppStore((state) => state.setSharedLink);
    const [copied, setCopied] = useState(false);

    function close() {
        setSharedLink(null);
        setCopied(false);
    }

    return (
        <Dialog open={link !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link to tracks</DialogTitle>
                </DialogHeader>
                <Input
                    readOnly
                    aria-label="Link to tracks"
                    value={link ?? ''}
                    onFocus={(event) => event.target.select()}
                />
                <DialogFooter>
                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(link ?? '').then(
                                () => setCopied(true),
                                () => {},
                            );
                        }}
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
