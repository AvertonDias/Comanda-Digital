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
    LogOut,
    Utensils
} from "lucide-react";
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const allMenuItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['admin'] },
    { href: "/menu", label: "Cardápio", icon: BookOpen, roles: ['admin', 'waiter', 'ajudante'] },
    { href: "/tables", label: "Mesas", icon: ClipboardList, roles: ['admin', 'waiter', 'ajudante'] },
    { href: "/orders", label: "Pedidos", icon: SquareKanban, roles: ['admin', 'waiter', 'ajudante'] },
    { href: "/customers", label: "Clientes", icon: Users, roles: ['admin'] },
    { href: "/settings", label: "Configurações", icon: Settings, roles: ['admin'] },
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const auth = useAuth();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { restaurantId, restaurant, role, isLoading: isResLoading, hasRestaurant } = useRestaurant();
    const { isMobile, setOpenMobile } = useSidebar();

    // 🔒 Contador de pedidos abertos para indicador visual
    const openOrdersQuery = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return query(
            collection(firestore, `restaurants/${restaurantId}/orders`),
            where('status', '==', 'aberto')
        );
    }, [restaurantId, firestore]);

    const { data: openOrders } = useCollection(openOrdersQuery);
    const openOrdersCount = openOrders?.length || 0;

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
        if (role === 'admin') {
            return allMenuItems;
        }
        // Para os ajudantes, eles podem ver apenas as abas Cardápio, Mesas e Pedidos
        return allMenuItems.filter(item => 
            item.href === '/menu' || item.href === '/tables' || item.href === '/orders'
        );
    }, [role]);
    
    const isLoading = isUserLoading;
    const userName = user?.displayName || user?.email || 'Averton Silva Dias';
    const userAvatar = user?.photoURL || '';
    const userFallback = (user?.displayName || user?.email || 'A').charAt(0).toUpperCase();

    return (
        <>
            <SidebarHeader className="p-4 border-b">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs shrink-0">
                        <Utensils className="size-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm tracking-tight text-foreground truncate">
                            {restaurant?.name || "Ton Food"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                            Comanda Digital
                        </span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent className="p-2">
                <SidebarMenu>
                    {filteredMenuItems.map((item) => (
                         <SidebarMenuItem key={item.href}>
                             <SidebarMenuButton
                                 asChild
                                 isActive={isActive(item.href)}
                                 tooltip={{ children: item.label, side: "right" }}
                                 className="h-11 rounded-xl text-sm font-bold"
                             >
                                 <Link href={item.href} onClick={handleLinkClick} className="relative">
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                    
                                    {/* Indicador visual de pedidos pendentes */}
                                    {item.label === "Pedidos" && openOrdersCount > 0 && (
                                        <Badge className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-xs h-5 px-2 min-w-5 flex items-center justify-center font-black rounded-full animate-in zoom-in duration-300">
                                            {openOrdersCount}
                                        </Badge>
                                    )}
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
                        <SidebarMenuButton tooltip={{ children: 'Sair da Conta', side: 'right' }} onClick={handleLogout}>
                            <LogOut />
                            <span>Sair</span>
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
                                            {role === 'admin' ? 'Administrador' : 'Ajudante'}
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
