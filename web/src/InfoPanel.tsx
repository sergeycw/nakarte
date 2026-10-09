import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { config } from '@/config';

// children — строка поиска (design add-web-search-panoramas, «Где живёт строка поиска»)
export function InfoPanel({ children }: { children?: ReactNode }) {
    return (
        <Card className="pointer-events-auto w-full" size="sm" data-testid="info-panel">
            <CardHeader>
                <CardTitle>nakarte routing</CardTitle>
                <a className="text-muted-foreground text-sm underline" href={config.repoUrl}>
                    GitHub
                </a>
            </CardHeader>
            {children && <CardContent>{children}</CardContent>}
        </Card>
    );
}
