
'use client';
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarSeparator,
    useSidebar,
} from "@/components/ui/sidebar"
import { usePathname, useRouter } from "next/navigation";
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
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useMemo } from "react";

const allMenuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['admin'] },
    { href: "/menu", label: "Cardápio", icon: BookOpen, roles: ['admin', 'waiter'] },
    { href: "/orders", label: "Pedidos", icon: SquareKanban, roles: ['admin', 'waiter'] },
    { href: "/tables", label: "Mesas", icon: ClipboardList, roles: ['admin', 'waiter'] },
    { href: "/customers", label: "Clientes", icon: Users, roles: ['admin'] },
    { href: "/settings", label: "Configurações", icon: Settings, roles: ['admin'] },
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const auth = useAuth();
    const { user } = useUser();
    const { role } = useRestaurant();
    const { isMobile, setOpenMobile } = useSidebar();

    const isActive = (href: string) => pathname === href;

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    const handleLinkClick = () => {
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    // Filtra o menu baseado na role do usuário
    const filteredMenuItems = useMemo(() => {
        if (!role) return [];
        return allMenuItems.filter(item => item.roles.includes(role));
    }, [role]);
    
    const userName = user?.displayName || user?.email || DUMMY_USER.name;
    const userAvatar = user?.photoURL || DUMMY_USER.avatarUrl;
    const userFallback = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

    return (
        <>
            <SidebarHeader>
                <Logo />
            </SidebarHeader>
            <SidebarContent className="p-2">
                <SidebarMenu>
                    {filteredMenuItems.map((item) => (
                         <SidebarMenuItem key={item.href}>
                             <SidebarMenuButton
                                 asChild
                                 isActive={isActive(item.href)}
                                 tooltip={{ children: item.label, side: "right" }}
                             >
                                 <Link href={item.href} onClick={handleLinkClick}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                 </Link>
                             </SidebarMenuButton>
                         </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-2">
                <SidebarSeparator />
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip={{ children: 'Logout', side: 'right' }} onClick={handleLogout}>
                            <LogOut />
                            <span>Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton>
                            <Avatar className="size-6">
                                <AvatarImage src={userAvatar} alt={userName} />
                                <AvatarFallback>{userFallback}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{userName}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </>
    )
}
