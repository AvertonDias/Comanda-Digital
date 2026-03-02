'use client';
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSeparator,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DUMMY_USER } from "@/lib/placeholder-data";
import { Logo } from "../common/logo";
import { 
    LayoutDashboard,
    BookOpen,
    ClipboardList,
    SquareKanban,
    Users,
    Settings,
    LogOut
} from "lucide-react";

const menuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/menu", label: "Cardápio", icon: BookOpen },
    { href: "/orders", label: "Pedidos", icon: SquareKanban },
    { href: "/tables", label: "Mesas", icon: ClipboardList },
    { href: "/customers", label: "Clientes", icon: Users },
    { href: "/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
    const pathname = usePathname();
    const isActive = (href: string) => pathname === href;

    return (
        <>
            <SidebarHeader>
                <Logo />
            </SidebarHeader>
            <SidebarContent className="p-2">
                <SidebarMenu>
                    {menuItems.map((item) => (
                         <SidebarMenuItem key={item.href}>
                             <SidebarMenuButton
                                 href={item.href}
                                 asChild
                                 isActive={isActive(item.href)}
                                 tooltip={{ children: item.label, side: "right" }}
                             >
                                 <item.icon />
                                 <span>{item.label}</span>
                             </SidebarMenuButton>
                         </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-2">
                <SidebarMenuSeparator />
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip={{ children: 'Logout', side: 'right' }}>
                            <LogOut />
                            <span>Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton>
                            <Avatar className="size-6">
                                <AvatarImage src={DUMMY_USER.avatarUrl} alt={DUMMY_USER.name} />
                                <AvatarFallback>{DUMMY_USER.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{DUMMY_USER.name}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </>
    )
}
