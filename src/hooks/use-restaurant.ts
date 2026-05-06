'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { useMemo } from "react";
import type { RestaurantUserRole } from "@/lib/types";

type UseRestaurantReturn = {
    restaurantId: string | null;
    role: RestaurantUserRole['role'] | null;
    isLoading: boolean;
    hasRestaurant: boolean;
    error: unknown;
};

/**
 * Hook blindado para gestão do restaurante ativo do usuário.
 * Evita disparar queries antes da autenticação estar pronta.
 */
export function useRestaurant(): UseRestaurantReturn {
    const { user, isUserLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();

    // Consulta específica na subcoleção do usuário para evitar collectionGroup desnecessário e erros de permissão
    const rolesQuery = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return query(
            collection(firestore, `users/${user.uid}/restaurantRoles`),
            where('isActive', '==', true)
        );
    }, [user?.uid, firestore]);

    const {
        data: roles,
        isLoading: isRolesLoading,
        error
    } = useCollection<RestaurantUserRole>(rolesQuery);

    const restaurantInfo = useMemo(() => {
        if (!roles || roles.length === 0) return null;
        // Prioriza o primeiro restaurante ativo encontrado
        const active = roles[0];
        if (active) {
            return {
                id: active.restaurantId,
                role: active.role
            };
        }
        return null;
    }, [roles]);

    const isLoading = isAuthLoading || isRolesLoading;
    const restaurantId = restaurantInfo?.id ?? null;
    const role = restaurantInfo?.role ?? null;

    return {
        restaurantId,
        role,
        isLoading,
        hasRestaurant: !!restaurantId,
        error
    };
}