import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 font-bold text-lg tracking-tight",
        "group-data-[state=collapsed]/sidebar:justify-center",
        className,
      )}
    >
      <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-sm ring-1 ring-primary/20">
        <Image
          src="/app-icon.jpg"
          alt="Comanda Digital"
          width={36}
          height={36}
          className="size-full object-cover rounded-xl"
          referrerPolicy="no-referrer"
          priority
        />
      </div>
      <div className="flex flex-col group-data-[state=collapsed]/sidebar:hidden">
        <span className="font-extrabold text-foreground leading-none">
          Comanda<span className="text-primary ml-1">Digital</span>
        </span>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
          Gestão & Cardápio
        </span>
      </div>
    </div>
  );
}
