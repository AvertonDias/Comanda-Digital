import type { Table } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { QrCodeModal } from "./qr-code-modal";

type TableCardProps = {
    table: Table;
};

const statusConfig = {
    'livre': { text: 'Livre', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
    'ocupada': { text: 'Ocupada', variant: 'destructive', className: '' },
    'fechando': { text: 'Fechando', variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
} as const;


export function TableCard({ table }: TableCardProps) {
    const config = statusConfig[table.status];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{table.name}</CardTitle>
                <Badge variant={config.variant} className={config.className}>
                    {config.text}
                </Badge>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Clique para gerar o QR Code</p>
                <QrCodeModal table={table} />
            </CardContent>
        </Card>
    );
}

    