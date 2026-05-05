
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { useMemo } from "react";
import type { RestaurantUserRole } from "@/lib/types";

/**
 * Hook para obter o restaurante ativo e o papel do usuário atual.
 */
export function useRestaurant() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const rolesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, `users/${user.uid}/restaurantRoles`));
    }, [user, firestore]);

    const { data: roles, isLoading: areRolesLoading } = useCollection<RestaurantUserRole>(rolesQuery);

    const restaurantInfo = useMemo(() => {
        if (!roles || roles.length === 0) return null;
        // Por simplificação, pegamos o primeiro restaurante vinculado
        return {
            id: roles[0].restaurantId,
            role: roles[0].role,
        };
    }, [roles]);

    return { 
        restaurantId: restaurantInfo?.id, 
        role: restaurantInfo?.role,
        isLoading: isUserLoading || areRolesLoading,
        hasRestaurant: !!restaurantInfo
    };
}
