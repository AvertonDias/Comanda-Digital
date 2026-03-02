import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-semibold text-lg",
        // The group-data-[state=collapsed] is a selector that targets the parent
        // with the data-state="collapsed" attribute.
        // This is a neat trick to style the logo when the sidebar is collapsed.
        "group-data-[state=collapsed]/sidebar:justify-center",
        className,
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <UtensilsCrossed className="size-5 shrink-0" />
      </div>
      <span className="group-data-[state=collapsed]/sidebar:hidden">
        Comanda Digital
      </span>
    </div>
  );
}
