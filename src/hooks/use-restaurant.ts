
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { useMemo } from "react";
import type { UserProfile } from "@/lib/types";

type UseRestaurantReturn = {
    restaurantId: string | null;
    isLoading: boolean;
    hasRestaurant: boolean;
    error: any;
};

/**
 * useRestaurant() BLINDADO v3
 * 
 * Busca o ID do restaurante diretamente do perfil do usuário para evitar consultas globais.
 * Garante que nunca retorne 'undefined' para as queries subsequentes.
 */
export function useRestaurant(): UseRestaurantReturn {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userRef = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user?.uid, firestore]);

    const { data: userProfile, isLoading: isProfileLoading, error } = useDoc<UserProfile>(userRef);

    const restaurantId = useMemo(() => {
        return userProfile?.activeRestaurantId || null;
    }, [userProfile]);

    return {
        restaurantId,
        isLoading: isUserLoading || isProfileLoading,
        hasRestaurant: !!restaurantId,
        error
    };
}
