
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '@/firebase/provider';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * Tenta extrair o caminho da coleção de forma segura.
 */
function getCollectionPath(target: any): string {
  if (!target) return 'unknown';
  if (target instanceof CollectionReference) return target.path;
  // Para objetos Query, tentamos acessar propriedades internas de forma segura ou propriedades conhecidas
  if (target.path) return target.path;
  if (target._query?.path?.segments) return target._query.path.segments.join('/');
  return 'collection_query';
}

export function useCollection<T = any>(
  memoizedTargetRefOrQuery:
    | ((CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean })
    | null
    | undefined
): UseCollectionResult<T> {
  const { user, isUserLoading } = useUser();
  type ResultItemType = WithId<T>;

  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // Diretiva do Firebase Skill: Só anexar onSnapshot se auth estiver pronta
    if (isUserLoading) {
      setIsLoading(true);
      return;
    }

    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = snapshot.docs.map(doc => ({
          ...(doc.data() as T),
          id: doc.id,
        }));

        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (firebaseError: FirestoreError) => {
        const path = getCollectionPath(memoizedTargetRefOrQuery);

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        // Apenas propaga evento fatal se o usuário já estiver confirmado como autenticado
        if (!isUserLoading && user) {
          errorEmitter.emit('permission-error', contextualError);
        }
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery, isUserLoading, user]);

  if (memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(
      'Query não foi memoizada corretamente. Use useMemoFirebase.'
    );
  }

  return { data, isLoading, error };
}
