import type { Table } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { QrCodeModal } from "./qr-code-modal";

type TableCardProps = {
    table: Table;
};

export function TableCard({ table }: TableCardProps) {
    const isOccupied = table.status === 'Ocupada';
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{table.name}</CardTitle>
                <Badge variant={isOccupied ? 'destructive' : 'default'} className={!isOccupied ? 'bg-green-500' : ''}>
                    {table.status}
                </Badge>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Clique para gerar o QR Code</p>
                <QrCodeModal table={table} />
            </CardContent>
        </Card>
    );
}
