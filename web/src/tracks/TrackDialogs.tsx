import { LoaderCircleIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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

// Название точки трека: после постановки и по Rename в меню точки (prompt «New point name» старого клиента). Cancel
// оставляет прежнее название, пустое допустимо.
export function PointNameDialog() {
    const dialog = useAppStore((state) => state.pointDialog);
    return dialog ? <PointNameForm key={`${dialog.trackId}:${dialog.point.name}`} /> : null;
}

function PointNameForm() {
    const actions = useTrackActions();
    const dialog = useAppStore((state) => state.pointDialog);
    const setPointDialog = useAppStore((state) => state.setPointDialog);
    const [name, setName] = useState(dialog?.point.name ?? '');
    if (!dialog) {
        return null;
    }
    const close = () => setPointDialog(null);
    function submit() {
        if (dialog) {
            actions.renamePoint(dialog.trackId, dialog.point, name);
        }
        close();
    }
    return (
        <Dialog open onOpenChange={(open) => !open && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Point name</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <Input
                        aria-label="Point name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onFocus={(event) => event.target.select()}
                    />
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button onClick={submit}>Ok</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Текст, который не удалось положить в буфер обмена: ссылка на треки (design add-web-tracks, «Ссылка — после ответа
// хранилища»), координаты точки (design add-web-line-tools, «Точки трека»)
export function CopyFallbackDialog() {
    const fallback = useAppStore((state) => state.copyFallback);
    const setCopyFallback = useAppStore((state) => state.setCopyFallback);
    const [copied, setCopied] = useState(false);

    function close() {
        setCopyFallback(null);
        setCopied(false);
    }

    return (
        <Dialog open={fallback !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{fallback?.title}</DialogTitle>
                </DialogHeader>
                <Input
                    readOnly
                    aria-label={fallback?.title}
                    value={fallback?.text ?? ''}
                    onFocus={(event) => event.target.select()}
                />
                <DialogFooter>
                    <Button
                        onClick={() => {
                            navigator.clipboard.writeText(fallback?.text ?? '').then(
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

// Шаги — пересказ справки производителей, ссылки — на неё же (design send-route-to-device, «Одно окно на три бренда»)
const DEVICE_APPS = [
    {
        name: 'Garmin Connect',
        steps: 'Share the file to Garmin Connect on your phone, or import it on the website: Training & Planning → Courses → Import. Then send the course to your device.',
        help: 'https://support.garmin.com/en-US/?faq=wKuZXCaZRP4mWPX5aRz5h5',
    },
    {
        name: 'Wahoo',
        steps: 'Open the file with the Wahoo app (the ELEMNT app for older ELEMNT, BOLT and ROAM), then Explore → My Collection → My Routes → the route → Send to ELEMNT.',
        help: 'https://support.wahoofitness.com/hc/en-us/articles/25936827245970',
    },
    {
        name: 'COROS',
        steps: 'Open the file with the COROS app and tap Save, then Explore → route library → the route → Sync with Your Device.',
        help: 'https://support.coros.com/hc/en-us/articles/24181489692436',
    },
];

// Окно «Send to device» (спека track-files): файл собирает sendToDevice, «Share» зовёт share() прямо из нажатия
export function DeviceSendDialog() {
    const actions = useTrackActions();
    const device = useAppStore((state) => state.deviceFile);
    const setDeviceFile = useAppStore((state) => state.setDeviceFile);
    // шторка открыта: второе нажатие получило бы InvalidStateError и скачало файл при открытой шторке
    const [sharing, setSharing] = useState(false);
    // фокус при открытии — на главную кнопку (без него — на первую ссылку Help); пока файл собирается, она неактивна,
    // но фокусируема (focusableWhenDisabled)
    const main = useRef<HTMLButtonElement>(null);
    const ready = Boolean(device?.file);
    function share() {
        setSharing(true);
        actions.shareDeviceFile().finally(() => setSharing(false));
    }
    return (
        <Dialog open={device !== null} onOpenChange={(open) => !open && setDeviceFile(null)}>
            {/* три блока инструкции и две кнопки выше телефона, повёрнутого горизонтально: окно прокручивается */}
            <DialogContent initialFocus={main} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Send to device</DialogTitle>
                    <DialogDescription>
                        {ready ? (
                            `GPX of “${device?.trackName}” for your watch or bike computer app.`
                        ) : (
                            <span className="flex items-center gap-2">
                                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
                                Preparing GPX…
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>
                {device?.elevationError && (
                    <p className="text-destructive">
                        Elevation data unavailable: {device.elevationError}. The file has no elevation.
                    </p>
                )}
                <div className="grid gap-3">
                    {DEVICE_APPS.map((app) => (
                        <section key={app.name} aria-label={app.name}>
                            <h3 className="font-medium">{app.name}</h3>
                            <p className="text-muted-foreground">
                                {app.steps}{' '}
                                <a className="text-primary underline" href={app.help} target="_blank" rel="noreferrer">
                                    Help
                                </a>
                            </p>
                        </section>
                    ))}
                </div>
                <DialogFooter>
                    <Button
                        ref={actions.canShareFiles ? undefined : main}
                        focusableWhenDisabled
                        variant={actions.canShareFiles ? 'outline' : 'default'}
                        disabled={!ready}
                        onClick={actions.downloadDeviceFile}
                    >
                        Download
                    </Button>
                    {actions.canShareFiles && (
                        <Button ref={main} focusableWhenDisabled disabled={!ready || sharing} onClick={share}>
                            Share
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
