'use client';
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
import { useEffect, useState } from "react";

type QrCodeModalProps = {
    table: Table;
};

export function QrCodeModal({ table }: QrCodeModalProps) {
    const [qrImageUrl, setQrImageUrl] = useState('');

    useEffect(() => {
        // This needs to run on the client to get the origin
        const qrData = `${window.location.origin}/${table.restaurantId}/${table.id}`;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
        setQrImageUrl(url);
    }, [table.restaurantId, table.id]);


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
                    {qrImageUrl ? (
                        <Image src={qrImageUrl} alt={`QR Code for ${table.name}`} width={250} height={250} />
                    ) : (
                        <div className="w-[250px] h-[250px] bg-muted animate-pulse rounded-md" />
                    )}
                </div>
                <DialogFooter>
                    <Button asChild variant="secondary" disabled={!qrImageUrl}>
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

    