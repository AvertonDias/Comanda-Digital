
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { useMemo } from "react";
import type { UserProfile, RestaurantUser } from "@/lib/types";

type UseRestaurantReturn = {
    restaurantId: string | null;
    role: 'admin' | 'waiter' | null;
    isLoading: boolean;
    hasRestaurant: boolean;
    error: any;
};

/**
 * useRestaurant()
 * 
 * Busca o ID do restaurante e o papel do usuário (role) de forma segura.
 */
export function useRestaurant(): UseRestaurantReturn {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    // 1. Busca o perfil para saber qual o restaurante ativo
    const userRef = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user?.uid, firestore]);

    const { data: userProfile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userRef);

    const restaurantId = useMemo(() => {
        return userProfile?.activeRestaurantId || null;
    }, [userProfile]);

    // 2. Busca o papel do usuário dentro desse restaurante na subcoleção de equipe
    const teamMemberRef = useMemoFirebase(() => {
        if (!restaurantId || !user?.uid || !firestore) return null;
        return doc(firestore, `restaurants/${restaurantId}/team`, user.uid);
    }, [restaurantId, user?.uid, firestore]);

    const { data: teamMember, isLoading: isRoleLoading } = useDoc<RestaurantUser>(teamMemberRef);

    // O carregamento só termina quando o perfil E o cargo terminarem de carregar
    const isLoading = isUserLoading || isProfileLoading || (!!restaurantId && isRoleLoading);

    const detectedRole = useMemo(() => {
        // Se houver um cargo explícito no banco, usamos ele
        if (teamMember?.role) return teamMember.role;
        
        // Se o carregamento terminou e o usuário tem um restaurante mas não está na equipe
        // assumimos que ele é o administrador/criador (caso de fallback)
        if (restaurantId && !isRoleLoading && !isProfileLoading) return 'admin';
        
        return null;
    }, [teamMember?.role, restaurantId, isRoleLoading, isProfileLoading]);

    return {
        restaurantId,
        role: detectedRole,
        isLoading,
        hasRestaurant: !!restaurantId,
        error: profileError
    };
}
