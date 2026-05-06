
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
 * useRestaurant() BLINDADO
 * 
 * Utiliza a desnormalização estratégica do perfil do usuário para buscar o ID do restaurante.
 * Isso evita consultas na raiz que disparam erros de permissão e garante performance.
 */
export function useRestaurant(): UseRestaurantReturn {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    // Memoiza a referência para evitar re-renderizações infinitas
    const userRef = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user?.uid, firestore]);

    const { data: userProfile, isLoading: isProfileLoading, error } = useDoc<UserProfile & { activeRestaurantId?: string }>(userRef);

    const restaurantId = useMemo(() => {
        // Retorna explicitamente null se não houver dado, evitando undefined que quebra queries
        return userProfile?.activeRestaurantId ?? null;
    }, [userProfile]);

    return {
        restaurantId,
        isLoading: isUserLoading || isProfileLoading,
        hasRestaurant: !!restaurantId,
        error
    };
}
