
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
 * useRestaurant() BLINDADO
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

    // 2. Busca o papel do usuário dentro desse restaurante
    const teamMemberRef = useMemoFirebase(() => {
        if (!restaurantId || !user?.uid || !firestore) return null;
        return doc(firestore, `restaurants/${restaurantId}/team`, user.uid);
    }, [restaurantId, user?.uid, firestore]);

    // Nota: O erro de permissão aqui é tratado silenciosamente durante o carregamento inicial
    const { data: teamMember, isLoading: isRoleLoading } = useDoc<RestaurantUser>(teamMemberRef);

    // O carregamento só termina quando o perfil E o cargo (se o id existir) terminarem
    const isLoading = isUserLoading || isProfileLoading || (!!restaurantId && isRoleLoading);

    // Lógica de fallback: Se o usuário tem um restaurante mas o registro na equipe ainda não existe no DB,
    // ele é tratado como Admin (caso de criador novo).
    const detectedRole = useMemo(() => {
        if (teamMember?.role) return teamMember.role;
        // Fallback de segurança para administradores que acabaram de criar o restaurante
        if (restaurantId && !isRoleLoading) return 'admin';
        return null;
    }, [teamMember?.role, restaurantId, isRoleLoading]);

    return {
        restaurantId,
        role: detectedRole,
        isLoading,
        hasRestaurant: !!restaurantId,
        error: profileError
    };
}
