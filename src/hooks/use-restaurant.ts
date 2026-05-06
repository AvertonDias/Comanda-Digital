'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { useMemo } from "react";
import type { RestaurantUserRole } from "@/lib/types";

/**
 * Hook para obter o restaurante ativo do usuário.
 * Utiliza o caminho direto da subcoleção para evitar erros de permissionamento em collectionGroup iniciais.
 */
export function useRestaurant() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const rolesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Consulta os papéis diretamente na subcoleção do usuário
        return query(collection(firestore, `users/${user.uid}/restaurantRoles`));
    }, [user, firestore]);

    const { data: roles, isLoading: areRolesLoading } = useCollection<RestaurantUserRole>(rolesQuery);

    const restaurantInfo = useMemo(() => {
        if (!roles || roles.length === 0) return null;
        // Prioriza admin, senão pega o primeiro ativo
        const activeRole = roles.find(r => r.role === 'admin' && r.isActive) || roles.find(r => r.isActive) || roles[0];
        return {
            id: activeRole.restaurantId,
            role: activeRole.role,
        };
    }, [roles]);

    return { 
        restaurantId: restaurantInfo?.id, 
        role: restaurantInfo?.role,
        isLoading: isUserLoading || areRolesLoading,
        hasRestaurant: !!restaurantInfo
    };
}