import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { QrCode, Download } from "lucide-react";
import type { Table } from "@/lib/types";
import Image from "next/image";

type QrCodeModalProps = {
    table: Table;
};

export function QrCodeModal({ table }: QrCodeModalProps) {
    const qrData = `${window.location.origin}/menu/rest-1/${table.id}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                    <QrCode className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>QR Code para {table.name}</DialogTitle>
                    <DialogDescription>
                        Os clientes podem escanear este código para acessar o cardápio e fazer pedidos diretamente da mesa.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center p-4">
                    <Image src={qrImageUrl} alt={`QR Code for ${table.name}`} width={250} height={250} />
                </div>
                <DialogFooter>
                    <Button asChild variant="secondary">
                        <a href={qrImageUrl} download={`qrcode-${table.name}.png`}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar
                        </a>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
