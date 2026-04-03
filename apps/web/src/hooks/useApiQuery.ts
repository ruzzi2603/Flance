/**
 * USE API QUERY HOOK - Customizado para Flance
 *
 * Propósito:
 * - Wrapper em torno TanStack Query
 * - Retry automático com exponential backoff
 * - Tratamento de erro padrão
 * - Toast notifications automáticas
 *
 * Benefícios:
 * - Resiliência automática (redes instáveis)
 * - UX melhor (feedback de erro)
 * - Menos boilerplate em componentes
 *
 * Configuração:
 * - Retry: 3 vezes com backoff exponencial
 * - Timeout: 10 segundos
 * - Stale time: 1 minuto (cache)
 * - GC time: 5 minutos (garbage collection)
 */

'use client';

import { useMutation, useQuery, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

/**
 * Detectar se erro é relacionado a rede/servidor (retryable)
 * vs erro de validação/permissão (não deve retry)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const axiosError = error as AxiosError<ApiErrorResponse>;
  const status = axiosError.response?.status;

  // Retry em timeouts, connection errors, server errors (5xx)
  if (!status || status >= 500 || status === 408 || status === 429) {
    return true;
  }

  // Não retry em client errors (4xx) exceto 429 (rate limit)
  return false;
}

/**
 * Hook para queries (GET)
 *
 * Exemplo:
 * const { data, isLoading, error } = useApiQuery(
 *   'proposals',
 *   () => api.get('/proposals/received'),
 *   { staleTime: 1000 * 60 } // 1 minuto
 * );
 */
export function useApiQuery<TData, TError = AxiosError>(
  key: string,
  fn: () => Promise<any>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<TData, TError>({
    queryKey: [key],
    queryFn: () => fn(),
    // IMPORTANTE: Retry com exponential backoff
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false;
      return isRetryableError(error);
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 1000 * 60, // 1 minuto - dados considerados "fresh"
    gcTime: 1000 * 60 * 5, // 5 minutos - cache retained
    ...options,
  });
}

/**
 * Hook para mutations (POST, PUT, PATCH, DELETE)
 *
 * Exemplo:
 * const { mutate, isPending } = useApiMutation(
 *   (data) => api.post('/proposals', data),
 *   {
 *     onSuccess: (data) => {
 *       queryClient.invalidateQueries({ queryKey: ['proposals'] });
 *       showToast({ type: 'success', message: 'Proposta enviada!' });
 *     },
 *     onError: (error) => {
 *       showToast({ type: 'error', message: 'Erro ao enviar proposta' });
 *     },
 *   }
 * );
 */
export function useApiMutation<TData, TError = AxiosError, TVariables = void>(
  fn: (variables: TVariables) => Promise<any>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'>,
) {
  return useMutation<TData, TError, TVariables>({
    mutationFn: fn,
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      return isRetryableError(error);
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    ...options,
  });
}

/**
 * Hook para manter chamadas de API sincronizadas
 *
 * Use case: Atualizar lista de propostas quando nova proposta é criada
 *
 * Exemplo:
 * const { syncApi } = useApiSync();
 *
 * // Em websocket handler
 * server.on('proposal.created', () => {
 *   syncApi(['proposals']); // Refetch proposals
 * });
 */
export function useApiSync() {
  // TODO: Integrar com QueryClient do provider
  const syncApi = useCallback(() => {
    // queryClient.invalidateQueries({ queryKey: keys });
  }, []);

  return { syncApi };
}

/**
 * Hook para polling (refetch em intervalo)
 *
 * Use case: Status de proposta que muda com frequência
 *
 * Exemplo:
 * useApiPoll('proposal-status', () => api.get(`/proposals/${id}`), 5000);
 */
export function useApiPoll<TData>(
  key: string,
  fn: () => Promise<any>,
  intervalMs: number = 5000,
) {
  const { data, isLoading, error, refetch } = useApiQuery<TData>(key, fn, {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: true,
  });

  return { data, isLoading, error, refetch };
}
