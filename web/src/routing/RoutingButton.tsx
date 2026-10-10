import { ChevronDownIcon, LoaderCircleIcon, RouteIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/state/context';
import { ACTIVITIES, getActivity } from './brouter';
import { useRouteEditing } from './editing-context';
import { routerDownHint, routerDownStatus } from './router';

// Кнопка и меню прокладки в строке списка треков, после «New track», как у старого клиента (спека routing, «Меню
// активностей»): активна при выбранной активности, красная при недоступном роутере, со спиннером, пока движок
// загружается (спека routing, «Движок загружается на кнопке прокладки»). Открытие меню перепроверяет живость роутера.

const OFF = 'off';

// labeled — с названием активности (редактор в верхней строке, макет 4a): «Hiking ▾»; уже 640 px —
// только иконка, активность — в title: место в строке отдано названию трека (design editor-name-share)
export function RoutingButton({ labeled = false }: { labeled?: boolean }) {
    const editing = useRouteEditing();
    const activityId = useAppStore((state) => state.routingActivity);
    const reachable = useAppStore((state) => state.routerReachable);
    const engineStatus = useSyncExternalStore(editing.subscribeEngine, editing.engineStatus);
    const activity = getActivity(activityId);
    const loading = activity !== null && engineStatus === 'loading';
    // движок, упавший на прогреве, — тоже «роутер недоступен», не дожидаясь первого маршрута
    const down = activity !== null && (!reachable || engineStatus === 'failed');

    let title = 'Routing is off: lines are straight';
    if (activity && down) {
        title = `Routing: ${activity.title}. ${routerDownStatus(editing.engine)}`;
    } else if (loading) {
        title = `Routing: ${activity.title}. BRouter engine is loading`;
    } else if (activity) {
        title = `Routing: ${activity.title}`;
    }

    let tone = '';
    if (down) {
        tone = 'text-destructive hover:text-destructive';
    } else if (activity) {
        tone = 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary';
    }

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (open) {
                    editing.checkRouter();
                }
            }}
        >
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size={labeled ? 'sm' : 'icon-sm'}
                        aria-label={title}
                        title={title}
                        className={cn(tone, labeled && 'max-sm:size-7 max-sm:px-0')}
                        data-state={down ? 'down' : loading ? 'loading' : activity ? 'on' : 'off'}
                    />
                }
            >
                {loading ? <LoaderCircleIcon className="animate-spin" /> : <RouteIcon />}
                {labeled && (
                    <>
                        <span className="hidden max-w-24 truncate sm:inline">{activity?.title ?? 'Off'}</span>
                        <ChevronDownIcon className="hidden opacity-60 sm:block" />
                    </>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Routing</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        value={activity?.id ?? OFF}
                        onValueChange={(value) => editing.setActivity(value === OFF ? null : String(value))}
                    >
                        <DropdownMenuRadioItem value={OFF} closeOnClick>
                            Off: straight lines
                        </DropdownMenuRadioItem>
                        {ACTIVITIES.map((item) => (
                            <DropdownMenuRadioItem key={item.id} value={item.id} closeOnClick>
                                {item.title}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                {/* хоткеи Undo и Redo — в title их кнопок, пункта о них в меню нет (design editor-row-cleanup) */}
                {down && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="text-destructive">
                            {routerDownHint(editing.engine)}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
