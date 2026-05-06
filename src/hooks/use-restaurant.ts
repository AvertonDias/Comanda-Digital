'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { useMemo } from "react";
import type { RestaurantUserRole } from "@/lib/types";

/**
 * Hook blindado para obter o restaurante ativo do usuário.
 * Garante que o restaurantId seja apenas string ou null, evitando erros de permissão.
 */
export function useRestaurant() {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();

    const rolesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Consulta os papéis do usuário logado
        return query(collection(firestore, `users/${user.uid}/restaurantRoles`));
    }, [user, firestore]);

    const { data: roles, isLoading: areRolesLoading } = useCollection<RestaurantUserRole>(rolesQuery);

    const restaurantInfo = useMemo(() => {
        if (!roles || roles.length === 0) return null;
        
        // Prioriza admin ativo, senão qualquer papel ativo
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
