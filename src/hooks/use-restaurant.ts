'use client';

import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, limit, setDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { useMemo, useEffect, useState } from "react";
import type { UserProfile, RestaurantUser, Restaurant } from "@/lib/types";

// ID de restaurante principal (Ton Food)
const DEFAULT_FALLBACK_RESTAURANT_ID = 'sCYFJhpQ32PTxbESUvkF';

type UseRestaurantReturn = {
    restaurantId: string | null;
    restaurant: Restaurant | null;
    role: 'admin' | 'waiter' | 'ajudante' | null;
    isLoading: boolean;
    hasRestaurant: boolean;
    error: any;
    setActiveRestaurantId: (id: string) => void;
};

/**
 * useRestaurant()
 * 
 * Busca o ID do restaurante e o papel do usuário (role) de forma resiliente.
 * Garante a criação e persistência do restaurante Ton Food caso não exista no novo banco.
 */
export function useRestaurant(): UseRestaurantReturn {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [localRestaurantId, setLocalRestaurantId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('activeRestaurantId') || DEFAULT_FALLBACK_RESTAURANT_ID;
        }
        return DEFAULT_FALLBACK_RESTAURANT_ID;
    });

    // 1. Busca o perfil do usuário
    const userRef = useMemoFirebase(() => {
        if (!user?.uid || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user?.uid, firestore]);

    const { data: userProfile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userRef);

    // 2. Busca lista de restaurantes existentes no banco
    const restaurantsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'restaurants'), limit(5));
    }, [firestore]);

    const { data: availableRestaurants } = useCollection<Restaurant>(restaurantsQuery);

    // Determina o ID do restaurante de forma robusta e sem falhas
    const restaurantId = useMemo(() => {
        if (userProfile?.activeRestaurantId) return userProfile.activeRestaurantId;
        if (localRestaurantId) return localRestaurantId;
        if (availableRestaurants && availableRestaurants.length > 0) {
            return availableRestaurants[0].id;
        }
        return DEFAULT_FALLBACK_RESTAURANT_ID;
    }, [userProfile?.activeRestaurantId, localRestaurantId, availableRestaurants]);

    // 3. Busca os dados do restaurante em tempo real
    const restaurantRef = useMemoFirebase(() => {
        if (!restaurantId || !firestore) return null;
        return doc(firestore, 'restaurants', restaurantId);
    }, [restaurantId, firestore]);

    const { data: restaurantData } = useDoc<Restaurant>(restaurantRef);

    // 4. Busca o papel do usuário dentro desse restaurante
    const teamMemberRef = useMemoFirebase(() => {
        if (!restaurantId || !user?.uid || !firestore) return null;
        return doc(firestore, `restaurants/${restaurantId}/team`, user.uid);
    }, [restaurantId, user?.uid, firestore]);

    const { data: teamMember } = useDoc<RestaurantUser>(teamMemberRef);

    // Efeito para sincronizar e garantir que o restaurante Ton Food e perfil existam no Firestore
    useEffect(() => {
        if (restaurantId && typeof window !== 'undefined') {
            localStorage.setItem('activeRestaurantId', restaurantId);
        }

        if (firestore && restaurantId) {
            // Garante que o documento do restaurante Ton Food existe no banco (setDoc com merge)
            const restaurantDocRef = doc(firestore, 'restaurants', restaurantId);
            setDoc(restaurantDocRef, {
                id: restaurantId,
                name: 'Ton Food',
                city: 'Monte Santo de Minas',
                phone: '(35) 9 9121 0466',
                pixKey: 'tonpixnu@gmail.com',
                openingHours: 'Ter, Qui, Sex, Sáb, Dom, Qua: 18:00 às 23:00',
                deliveryFee: 5,
                plan: 'basico',
                status: 'ativo',
                createdAt: serverTimestamp()
            }, { merge: true }).catch(err => {
                console.error("Erro ao sincronizar restaurante:", err);
            });

            // Se o usuário estiver autenticado, salva no perfil e na equipe
            if (user?.uid) {
                const profileDocRef = doc(firestore, 'users', user.uid);
                setDoc(profileDocRef, {
                    activeRestaurantId: restaurantId,
                    name: user.displayName || user.email || 'Usuário',
                    email: user.email || '',
                    avatarUrl: user.photoURL || ''
                }, { merge: true }).catch(() => {});

                const teamDocRef = doc(firestore, `restaurants/${restaurantId}/team`, user.uid);
                const teamData: any = {
                    userId: user.uid,
                    email: user.email || '',
                    name: user.displayName || user.email || 'Colaborador',
                    isActive: true
                };

                // Preserva o papel existente (como 'waiter' ou 'ajudante') sem sobrescrever!
                // Apenas define 'admin' para o proprietário ou se ainda não tiver papel definido
                if (!teamMember?.role) {
                    if (user.email === 'verton3@gmail.com') {
                        teamData.role = 'admin';
                    } else {
                        teamData.role = 'waiter';
                    }
                }
                setDoc(teamDocRef, teamData, { merge: true }).catch(() => {});
            }
        }
    }, [user?.uid, user?.displayName, user?.email, user?.photoURL, firestore, restaurantId, teamMember?.role]);

    const setActiveRestaurantId = (id: string) => {
        setLocalRestaurantId(id);
        if (typeof window !== 'undefined') {
            localStorage.setItem('activeRestaurantId', id);
        }
        if (user?.uid && firestore) {
            setDoc(doc(firestore, 'users', user.uid), { activeRestaurantId: id }, { merge: true }).catch(() => {});
        }
    };

    const detectedRole = useMemo<'admin' | 'waiter' | 'ajudante'>(() => {
        if (teamMember?.role) return teamMember.role;
        if (user?.email === 'verton3@gmail.com') return 'admin';
        return 'waiter';
    }, [teamMember?.role, user?.email]);

    const isLoading = isUserLoading;

    return {
        restaurantId,
        restaurant: restaurantData || {
            id: restaurantId,
            name: 'Ton Food',
            city: 'Monte Santo de Minas',
            phone: '(35) 9 9121 0466',
            pixKey: 'tonpixnu@gmail.com',
            openingHours: 'Ter, Qui, Sex, Sáb, Dom, Qua: 18:00 às 23:00',
            deliveryFee: 5,
            plan: 'basico',
            status: 'ativo',
            createdAt: null
        },
        role: detectedRole,
        isLoading,
        hasRestaurant: true,
        error: profileError,
        setActiveRestaurantId
    };
}
