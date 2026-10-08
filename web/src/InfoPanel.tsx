import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { config } from '@/config';

export function InfoPanel() {
    return (
        <Card className="absolute top-3 left-3 z-10 w-64" size="sm" data-testid="info-panel">
            <CardHeader>
                <CardTitle>nakarte routing</CardTitle>
                <a className="text-muted-foreground text-sm underline" href={config.repoUrl}>
                    GitHub
                </a>
            </CardHeader>
        </Card>
    );
}
