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
import { Skeleton } from "@/components/ui/skeleton";

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
    const { user, isUserLoading } = useUser();
    const { role, isLoading: isResLoading, hasRestaurant } = useRestaurant();
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

    const filteredMenuItems = useMemo(() => {
        if (!role) return [];
        return allMenuItems.filter(item => item.roles.includes(role));
    }, [role]);
    
    const isLoading = isUserLoading || isResLoading;
    const userName = user?.displayName || user?.email || 'Usuário';
    const userAvatar = user?.photoURL || '';
    const userFallback = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

    return (
        <>
            <SidebarHeader>
                <Logo />
            </SidebarHeader>
            <SidebarContent className="p-2">
                <SidebarMenu>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <SidebarMenuItem key={i}>
                                <div className="flex items-center gap-2 p-2">
                                    <Skeleton className="h-4 w-4 rounded" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </SidebarMenuItem>
                        ))
                    ) : filteredMenuItems.length > 0 ? (
                        filteredMenuItems.map((item) => (
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
                        ))
                    ) : hasRestaurant ? (
                        <div className="p-4 text-xs text-muted-foreground text-center">
                            Carregando acessos...
                        </div>
                    ) : (
                        <div className="p-4 text-xs text-muted-foreground text-center">
                            Nenhum restaurante vinculado.
                        </div>
                    )}
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
                        <SidebarMenuButton className="h-12">
                            {isLoading ? (
                                <Skeleton className="size-8 rounded-full" />
                            ) : (
                                <Avatar className="size-8">
                                    <AvatarImage src={userAvatar} alt={userName} />
                                    <AvatarFallback>{userFallback}</AvatarFallback>
                                </Avatar>
                            )}
                            <div className="flex flex-col items-start overflow-hidden">
                                {isLoading ? (
                                    <Skeleton className="h-3 w-20" />
                                ) : (
                                    <>
                                        <span className="truncate font-medium text-xs">{userName}</span>
                                        <span className="text-[10px] text-muted-foreground capitalize">
                                            {role === 'admin' ? 'Administrador' : role === 'waiter' ? 'Garçom' : 'Usuário'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </>
    )
}
