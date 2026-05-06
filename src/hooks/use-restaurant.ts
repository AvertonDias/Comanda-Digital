
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { useMemo } from "react";
import type { RestaurantUserRole } from "@/lib/types";

/**
 * Hook blindado para obter o restaurante ativo do usuário.
 * Evita queries com undefined e sincroniza com o estado de autenticação.
 */
export function useRestaurant() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();

    const rolesQuery = useMemoFirebase(() => {
        // Se não houver usuário ou firestore, retornamos null explicitamente
        if (!user || !firestore) return null;
        // Consulta os papéis diretamente na subcoleção do usuário para maior segurança
        return query(collection(firestore, `users/${user.uid}/restaurantRoles`));
    }, [user, firestore]);

    const { data: roles, isLoading: areRolesLoading } = useCollection<RestaurantUserRole>(rolesQuery);

    const restaurantInfo = useMemo(() => {
        if (!roles || roles.length === 0) return null;
        
        // Prioriza admin ativo, senão pega o primeiro papel ativo disponível
        const activeRole = roles.find(r => r.role === 'admin' && r.isActive) || 
                          roles.find(r => r.isActive) || 
                          roles[0];
        
        if (!activeRole?.restaurantId) return null;

        return {
            id: activeRole.restaurantId,
            role: activeRole.role,
        };
    }, [roles]);

    return { 
        restaurantId: restaurantInfo?.id || null, 
        role: restaurantInfo?.role || null,
        isLoading: isAuthLoading || areRolesLoading,
        hasRestaurant: !!restaurantInfo?.id
    };
}
